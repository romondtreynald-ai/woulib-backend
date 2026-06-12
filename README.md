# Woulib Plus — Backend API

Node.js + Express backend for the Woulib Plus ride-hailing app.
Supports MonCash and NatCash payments, real-time driver tracking via Socket.IO, and PostgreSQL for data storage.

---

## Stack

- **Runtime**: Node.js
- **Framework**: Express
- **Database**: PostgreSQL
- **Real-time**: Socket.IO
- **Payments**: MonCash (Digicel) + NatCash (Natcom)
- **Auth**: JWT

---

## Setup in 5 steps

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Then open .env and fill in your values
```

### 3. Create the database
```bash
# Create a PostgreSQL database named woulib_plus
createdb woulib_plus

# Run the schema
npm run db:setup
```

### 4. Start the server
```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 5. Deploy to the internet
Use [Railway](https://railway.app) or [Render](https://render.com) — both are free to start and support Node.js + PostgreSQL in one click.

---

## API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register rider or driver |
| POST | `/api/auth/login` | Login and get JWT token |

### Rides
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/rides/book` | Rider books a ride |
| POST | `/api/rides/:id/accept` | Driver accepts a ride |
| POST | `/api/rides/:id/complete` | Mark ride as completed |
| GET | `/api/rides/history` | Get past rides |

### Payments
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/payments/initiate` | Start MonCash or NatCash payment |
| POST | `/api/payments/moncash/webhook` | MonCash payment confirmation |
| POST | `/api/payments/natcash/webhook` | NatCash payment confirmation |

---

## Real-time events (Socket.IO)

| Event | Direction | Description |
|-------|-----------|-------------|
| `ride:new_request` | Server → Drivers | New ride available |
| `ride:join` | Client → Server | Rider joins ride room |
| `ride:accepted` | Server → Rider | Driver accepted the ride |
| `driver:location` | Driver → Server | Driver sends GPS position |
| `ride:completed` | Server → Both | Ride is done |

---

## Payment credentials

**MonCash**: Register at https://sandbox.moncashbutton.digicelgroup.com to get test credentials. Switch to production URL when going live.

**NatCash**: Contact Natcom Haiti business team directly to get merchant API credentials.

---

## Connect the frontend

In your Woulib Plus frontend app, call the backend like this:

```javascript
// Login
const res = await fetch('https://your-api.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+50912345678', password: 'secret' })
});
const { token, user } = await res.json();

// Book a ride (include token in header)
const ride = await fetch('https://your-api.com/api/rides/book', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    pickup: 'City Hall Plaza',
    destination: 'Westfield Mall',
    rideType: 'WouGo',
    estimatedFare: 850
  })
});

// Connect to real-time
import { io } from 'socket.io-client';
const socket = io('https://your-api.com');
socket.emit('ride:join', rideId);
socket.on('driver:location', ({ lat, lng }) => {
  // update map marker
});
```
