const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  companyCode: { type: String, required: true, unique: true, uppercase: true },
  contact:     { type: String, required: true },
  email:       { type: String, default: '', trim: true, lowercase: true },
  password:    { type: String, required: true },
  isActive:    { type: Boolean, default: true },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', companySchema);
