require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./utils/db');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/company', require('./routes/company'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/designations', require('./routes/designations'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/holidays', require('./routes/holidays'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
