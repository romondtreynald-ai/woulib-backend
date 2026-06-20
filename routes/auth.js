const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../services/database');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, role } = req.body; // role: 'rider' or 'driver'

    if (!name || !phone || !password || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Check if phone already registered
    const existing = await db.query(
      'SELECT id FROM users WHERE phone = $1', [phone]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (name, phone, password, role, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, phone, role`,
      [name, phone, hashedPassword, role]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    const result = await db.query(
      'SELECT * FROM users WHERE phone = $1', [phone]
    );
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

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
