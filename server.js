const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
const paymentRoutes = require('./routes/payments');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors({ origin: ["https://woulib-frontend.vercel.app", "http://localhost:3000"] }));
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/rides', authMiddleware, rideRoutes);
app.use('/api/payments', authMiddleware, paymentRoutes);

// Health check
app.get('/', (req, res) => res.json({ status: 'Woulib Plus API running' }));

// Real-time: driver location + ride updates via Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Driver sends their live location
  socket.on('driver:location', ({ rideId, lat, lng }) => {
    io.to(`ride_${rideId}`).emit('driver:location', { lat, lng });
  });

  // Rider joins a ride room to get updates
  socket.on('ride:join', (rideId) => {
    socket.join(`ride_${rideId}`);
  });

  // Driver accepts a ride
  socket.on('ride:accepted', ({ rideId, driverInfo }) => {
    io.to(`ride_${rideId}`).emit('ride:accepted', driverInfo);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Woulib Plus backend running on port ${PORT}`));
