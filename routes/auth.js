const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../services/database');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, role, cinNumber, licensePlate, vehicleModel, licensePhotoUrl } = req.body;

    if (!name || !phone || !password || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (role === 'driver' && (!cinNumber || !licensePlate || !vehicleModel)) {
      return res.status(400).json({ error: 'Chofè yo bezwen CIN, plak machin, ak modèl machin' });
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE phone = $1', [phone]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (name, phone, password, role, cin_number, license_plate, vehicle_model, license_photo_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id, name, phone, role`,
      [name, phone, hashedPassword, role, cinNumber || null, licensePlate || null, vehicleModel || null, licensePhotoUrl || null]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });

    const result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
