/**
 * One-time migration script: converts old "one document per employee per day"
 * Attendance records into the new "one document per employee per month" structure.
 *
 * SAFE TO RUN MULTIPLE TIMES (idempotent) — it upserts into a staging collection
 * and does NOT touch or delete your existing "attendances" collection.
 *
 * Usage:
 *   node scripts/migrate-attendance-to-monthly.js
 *
 * Before running:
 *   1. Back up your MongoDB database.
 *   2. Make sure MONGODB_URI is set in your .env file.
 *   3. This script reads from the OLD "attendances" collection shape
 *      (date: "YYYY-MM-DD", status, remark) and writes into a staging
 *      collection "attendances_monthly_migrated". Review it, then rename
 *      collections manually once verified (instructions printed at the end).
 */
'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in environment. Aborting.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const oldCol = db.collection('attendances');
  const newColName = 'attendances_monthly_migrated';
  const newCol = db.collection(newColName);

  const cursor = oldCol.find({});
  let processed = 0;
  const buckets = new Map(); // key: companyId|employeeId|MM-YYYY -> { days: {} }

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const [y, m, d] = String(doc.date).split('-');
    if (!y || !m || !d) { console.warn('Skipping malformed date:', doc.date); continue; }
    const monthKey = `${m}-${y}`;
    const dayKey   = String(parseInt(d, 10));
    const bucketKey = `${doc.companyId}|${doc.employeeId}|${monthKey}`;

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        companyId: doc.companyId,
        employeeId: doc.employeeId,
        month: monthKey,
        days: {}
      });
    }
    buckets.get(bucketKey).days[dayKey] = { status: doc.status, remark: doc.remark || '' };
    processed++;
  }

  console.log(`Read ${processed} old daily records, grouped into ${buckets.size} monthly documents.`);

  // Clear any previous migration attempt in the staging collection
  await newCol.deleteMany({});

  const ops = [];
  for (const bucket of buckets.values()) {
    ops.push({
      updateOne: {
        filter: { companyId: bucket.companyId, employeeId: bucket.employeeId, month: bucket.month },
        update: { $set: bucket },
        upsert: true
      }
    });
  }

  if (ops.length) {
    const result = await newCol.bulkWrite(ops);
    console.log(`Wrote ${result.upsertedCount + result.modifiedCount} monthly documents into "${newColName}".`);
  }

  console.log('\nMigration staging complete.');
  console.log(`Review the "${newColName}" collection, then run these two commands in mongosh to finalize:`);
  console.log(`  db.attendances.renameCollection("attendances_old_backup");`);
  console.log(`  db.${newColName}.renameCollection("attendances");`);
  console.log('\nOnce verified working in production, you may drop "attendances_old_backup".');

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
