const mongoose = require('mongoose');

async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendancehub';

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✓ MongoDB connected');
    return mongoose.connection;
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
