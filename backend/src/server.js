'use strict';
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const os      = require('os');
const http    = require('http');
const connectDB = require('./utils/db');

const app  = express();
const PORT = process.env.PORT || 5900;

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // x-new-token carries the refreshed sliding-session JWT on every authenticated
  // response; browsers hide custom response headers from JS unless exposed here.
  exposedHeaders: ['x-new-token'],
  credentials: true
};

app.use(cors(corsOptions));
app.set('trust proxy', 1);
app.use(express.json());

app.use('/api/company',      require('./routes/company'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/employees',    require('./routes/employees'));
app.use('/api/attendance',   require('./routes/attendance'));
app.use('/api/holidays',     require('./routes/holidays'));
app.use('/api/designations', require('./routes/designations'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route not found' });
  res.status(404).json({ error: 'Not found' });
});

connectDB().then(() => {
  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    const nets = os.networkInterfaces();
    let localIP = 'localhost';
    outer: for (const iface of Object.values(nets)) {
      if (!iface) continue;
      for (const net of iface) {
        if (net.family === 'IPv4' && !net.internal) { localIP = net.address; break outer; }
      }
    }
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Network: http://${localIP}:${PORT}`);
    console.log(`LAN: http://${localIP}:${PORT}`);
  });
});
