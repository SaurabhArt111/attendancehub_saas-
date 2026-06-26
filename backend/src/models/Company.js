const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  companyCode: { type: String, required: true, unique: true, uppercase: true },
  email:       { type: String, required: true, lowercase: true, trim: true, unique: true },
  contact:     { type: String, required: true },
  password:    { type: String, required: true },
  isActive:    { type: Boolean, default: true },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', companySchema);
