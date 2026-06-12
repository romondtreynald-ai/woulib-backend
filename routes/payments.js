const express = require('express');
const router = express.Router();
const axios = require('axios');
const { db } = require('../services/database');

// ─────────────────────────────────────────────
//  MonCash helper
// ─────────────────────────────────────────────
async function initiateMonCash(phone, amount, rideId) {
  // MonCash uses OAuth2 + payment API
  // Docs: https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware
  const credentials = Buffer.from(
    `${process.env.MONCASH_CLIENT_ID}:${process.env.MONCASH_CLIENT_SECRET}`
  ).toString('base64');

  // Step 1: Get access token
  const tokenRes = await axios.post(
    `${process.env.MONCASH_BASE_URL}/oauth/token`,
    'grant_type=client_credentials&scope=read,write',
    { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const accessToken = tokenRes.data.access_token;

  // Step 2: Create payment
  const paymentRes = await axios.post(
    `${process.env.MONCASH_BASE_URL}/v1/CreatePayment`,
    { amount, orderId: `WOULIB-${rideId}-${Date.now()}` },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return {
    paymentToken: paymentRes.data.payment_token?.token,
    redirectUrl: `${process.env.MONCASH_BASE_URL}/payment?token=${paymentRes.data.payment_token?.token}`
  };
}

// ─────────────────────────────────────────────
//  NatCash helper
// ─────────────────────────────────────────────
async function initiateNatCash(phone, amount, rideId) {
  // NatCash API — contact Natcom for credentials
  // Endpoint structure may vary; this follows their typical pattern
  const res = await axios.post(
    `${process.env.NATCASH_BASE_URL}/api/payment/initiate`,
    {
      merchantId: process.env.NATCASH_MERCHANT_ID,
      phone,
      amount,
      currency: 'HTG',
      reference: `WOULIB-${rideId}`,
      callbackUrl: `${process.env.APP_URL}/api/payments/natcash/webhook`
    },
    { headers: { Authorization: `Bearer ${process.env.NATCASH_API_KEY}` } }
  );

  return { transactionId: res.data.transactionId, status: res.data.status };
}

// ─────────────────────────────────────────────
//  POST /api/payments/initiate
// ─────────────────────────────────────────────
router.post('/initiate', async (req, res) => {
  try {
    const { rideId, method, phone, amount } = req.body;
    // method: 'moncash' or 'natcash'

    let paymentData;
    if (method === 'moncash') {
      paymentData = await initiateMonCash(phone, amount, rideId);
    } else if (method === 'natcash') {
      paymentData = await initiateNatCash(phone, amount, rideId);
    } else {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Save pending payment to DB
    await db.query(
      `INSERT INTO payments (ride_id, method, phone, amount, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())`,
      [rideId, method, phone, amount]
    );

    res.json({ success: true, ...paymentData });
  } catch (err) {
    console.error('Payment initiation error:', err.message);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/payments/moncash/webhook
//  MonCash calls this URL when payment is confirmed
// ─────────────────────────────────────────────
router.post('/moncash/webhook', async (req, res) => {
  try {
    const { transactionId, orderId, amount } = req.body;

    // Extract rideId from orderId (format: WOULIB-{rideId}-{timestamp})
    const rideId = orderId.split('-')[1];

    await db.query(
      `UPDATE payments SET status = 'paid', transaction_id = $1
       WHERE ride_id = $2 AND method = 'moncash'`,
      [transactionId, rideId]
    );

    // Auto-complete the ride payment
    await db.query(
      `UPDATE rides SET payment_status = 'paid' WHERE id = $1`, [rideId]
    );

    res.json({ received: true });
  } catch (err) {
    console.error('MonCash webhook error:', err);
    res.status(500).json({ error: 'Webhook error' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/payments/natcash/webhook
// ─────────────────────────────────────────────
router.post('/natcash/webhook', async (req, res) => {
  try {
    const { transactionId, reference, status } = req.body;
    const rideId = reference.replace('WOULIB-', '');

    if (status === 'SUCCESS') {
      await db.query(
        `UPDATE payments SET status = 'paid', transaction_id = $1
         WHERE ride_id = $2 AND method = 'natcash'`,
        [transactionId, rideId]
      );

      await db.query(
        `UPDATE rides SET payment_status = 'paid' WHERE id = $1`, [rideId]
      );
    }

    res.json({ received: true });
  } catch (err) {
    console.error('NatCash webhook error:', err);
    res.status(500).json({ error: 'Webhook error' });
  }
});

module.exports = router;
