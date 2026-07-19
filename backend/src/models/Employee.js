const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  username:     { type: String, required: true, trim: true },              // Employee Name
  employeeId:   { type: String, required: true },   // system-generated unique ID
  contact:      { type: String, required: true },                          // Mobile Number (mandatory)
  password:     { type: String, default: '' },                             // optional at creation; set/updated later
  email:        { type: String, default: '', trim: true, lowercase: true },
  designation:  { type: String, default: '' },
  salaryType:   { type: String, enum: ['monthly', 'daily'], default: 'monthly' },
  salary:       { type: Number, default: 0 },       // monthly salary
  isActive:     { type: Boolean, default: true },
  archived:     { type: Boolean, default: false },
  archivedAt:   { type: Date },
  createdAt:    { type: Date, default: Date.now },

  // ── Identification Proof image ──────────────────────────────
  // Stored directly in MongoDB as compressed JPEG binary (Buffer).
  // Never written to a backend upload folder, and only the compressed
  // version is persisted (the original is compressed in-memory first).
  idProofData:        { type: Buffer },
  idProofContentType: { type: String, default: '' }, // always 'image/jpeg' once set
  idProofSize:         { type: Number },              // bytes, post-compression
  idProofUploadedAt:   { type: Date }
});

employeeSchema.index({ companyId: 1, username:   1 }, { unique: true });
employeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model('Employee', employeeSchema);
