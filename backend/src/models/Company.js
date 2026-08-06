const mongoose = require('mongoose');

// A single geofenced workplace location an employee can Clock In/Out from.
const workLocationSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  lat:          { type: Number, required: true },
  lng:          { type: Number, required: true },
  radiusMeters: { type: Number, default: 200, min: 10, max: 20000 }
}, { _id: true });

// Company-wide attendance configuration. Everything here defaults to the
// original, pre-existing behavior (admin marks attendance manually, no
// geofencing, every calendar day is a Weekend until the admin says
// otherwise) so a company that never visits the new Settings screens keeps
// working exactly as it did before this feature existed.
const attendanceSettingsSchema = new mongoose.Schema({
  // 'admin'    — admin manually marks attendance (original/default behavior)
  // 'employee' — employees Clock In/Out themselves from the Employee app
  method: { type: String, enum: ['admin', 'employee'], default: 'admin' },

  geofencing: {
    enabled:   { type: Boolean, default: false },
    locations: { type: [workLocationSchema], default: [] }
  },

  // Weekly-off schedule. `global` is 7 booleans indexed Sun(0)..Sat(6);
  // true = Weekend (day off), false = Working day. Per the product
  // requirement, Sunday is the default weekly off until an admin customizes
  // the working schedule.
  weekend: {
    global: {
      type: [Boolean],
      default: [true, false, false, false, false, false, false]
    }
  }
}, { _id: false });

const companySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  companyCode: { type: String, required: true, unique: true, uppercase: true },
  contact:     { type: String, required: true },
  email:       { type: String, default: '', trim: true, lowercase: true },
  password:    { type: String, required: true },
  isActive:    { type: Boolean, default: true },
  createdAt:   { type: Date, default: Date.now },

  settings: { type: attendanceSettingsSchema, default: () => ({}) }
});

module.exports = mongoose.model('Company', companySchema);
