const express = require('express');
const router = express.Router();
const { db } = require('../services/database');

// POST /api/rides/book  — rider books a ride
router.post('/book', async (req, res) => {
  try {
    const riderId = req.user.id;
    const { pickup, destination, rideType, estimatedFare } = req.body;

    const result = await db.query(
      `INSERT INTO rides (rider_id, pickup, destination, ride_type, estimated_fare, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'searching', NOW()) RETURNING *`,
      [riderId, pickup, destination, rideType, estimatedFare]
    );

    const ride = result.rows[0];

    // Notify nearby drivers (in a real app, filter by location using PostGIS)
    // For now, broadcast to all online drivers
    req.io.emit('ride:new_request', {
      rideId: ride.id,
      pickup,
      destination,
      rideType,
      estimatedFare
    });

    res.status(201).json({ ride });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rides/:id/accept  — driver accepts a ride
router.post('/:id/accept', async (req, res) => {
  try {
    const driverId = req.user.id;
    const rideId = req.params.id;

    const result = await db.query(
      `UPDATE rides SET driver_id = $1, status = 'accepted', accepted_at = NOW()
       WHERE id = $2 AND status = 'searching' RETURNING *`,
      [driverId, rideId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Ride no longer available' });
    }

    const ride = result.rows[0];

    // Get driver info to send to rider
    const driverResult = await db.query(
      'SELECT id, name, phone FROM users WHERE id = $1', [driverId]
    );

    req.io.to(`ride_${rideId}`).emit('ride:accepted', {
      driver: driverResult.rows[0]
    });

    res.json({ ride });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rides/:id/complete  — mark ride as done
router.post('/:id/complete', async (req, res) => {
  try {
    const rideId = req.params.id;

    const result = await db.query(
      `UPDATE rides SET status = 'completed', completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [rideId]
    );

    req.io.to(`ride_${rideId}`).emit('ride:completed', { rideId });

    res.json({ ride: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rides/history  — get rider's past rides
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const column = role === 'rider' ? 'rider_id' : 'driver_id';

    const result = await db.query(
      `SELECT r.*, u.name as other_party_name
       FROM rides r
       JOIN users u ON u.id = CASE WHEN $2 = 'rider' THEN r.driver_id ELSE r.rider_id END
       WHERE r.${column} = $1 AND r.status = 'completed'
       ORDER BY r.completed_at DESC LIMIT 20`,
      [userId, role]
    );

    res.json({ rides: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
