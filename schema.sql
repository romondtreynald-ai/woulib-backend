-- Woulib Plus — PostgreSQL schema
-- Run this once to set up your database

CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(20) UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        VARCHAR(10) CHECK (role IN ('rider', 'driver')) NOT NULL,
  rating      DECIMAL(3,2) DEFAULT 5.00,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE rides (
  id              SERIAL PRIMARY KEY,
  rider_id        INTEGER REFERENCES users(id),
  driver_id       INTEGER REFERENCES users(id),
  pickup          VARCHAR(255) NOT NULL,
  destination     VARCHAR(255) NOT NULL,
  ride_type       VARCHAR(20) DEFAULT 'WouGo',
  estimated_fare  DECIMAL(10,2),
  actual_fare     DECIMAL(10,2),
  status          VARCHAR(20) DEFAULT 'searching',
  -- status values: searching | accepted | in_progress | completed | cancelled
  payment_status  VARCHAR(20) DEFAULT 'unpaid',
  created_at      TIMESTAMP DEFAULT NOW(),
  accepted_at     TIMESTAMP,
  completed_at    TIMESTAMP
);

CREATE TABLE payments (
  id              SERIAL PRIMARY KEY,
  ride_id         INTEGER REFERENCES rides(id),
  method          VARCHAR(20) CHECK (method IN ('moncash', 'natcash')),
  phone           VARCHAR(20),
  amount          DECIMAL(10,2),
  currency        VARCHAR(5) DEFAULT 'HTG',
  status          VARCHAR(20) DEFAULT 'pending',
  -- status values: pending | paid | failed | refunded
  transaction_id  VARCHAR(100),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ratings (
  id          SERIAL PRIMARY KEY,
  ride_id     INTEGER REFERENCES rides(id),
  rater_id    INTEGER REFERENCES users(id),
  rated_id    INTEGER REFERENCES users(id),
  score       INTEGER CHECK (score BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
