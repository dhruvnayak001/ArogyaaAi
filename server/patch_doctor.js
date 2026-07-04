require('dotenv').config();
const mongoose = require('mongoose');

const EMAIL = 'dhruvr.nayak@gmail.com';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User         = require('./src/models/User.model');
  const Appointment  = require('./src/models/Appointment.model');
  const HealthRecord = require('./src/models/HealthRecord.model');
  const Notification = require('./src/models/Notification.model');

  const user = await User.findOne({ email: EMAIL }).lean();
  if (!user) {
    console.log(`❌ No account found for ${EMAIL}`);
    process.exit(0);
  }

  const id = user._id;

  /* ── Preview: count everything linked to this user ── */
  const [appts, records, notifs] = await Promise.all([
    Appointment.countDocuments({ $or: [{ patient: id }, { doctor: id }] }),
    HealthRecord.countDocuments({ user: id }),
    Notification.countDocuments({ user: id }),
  ]);

  console.log(`\n=== Account Deletion Preview ===`);
  console.log(`  User       : ${user.name} (${user.email})`);
  console.log(`  Role       : ${user.role}`);
  console.log(`  Appointments to delete : ${appts}`);
  console.log(`  Health records to delete : ${records}`);
  console.log(`  Notifications to delete  : ${notifs}`);
  console.log(`\n⚠️  This action is IRREVERSIBLE.`);
  console.log(`   Deleting in 3 seconds… (Ctrl+C to cancel)\n`);

  await new Promise((r) => setTimeout(r, 3000));

  /* ── Delete everything ── */
  const [dAppts, dRecords, dNotifs] = await Promise.all([
    Appointment.deleteMany({ $or: [{ patient: id }, { doctor: id }] }),
    HealthRecord.deleteMany({ user: id }),
    Notification.deleteMany({ user: id }),
  ]);

  await User.deleteOne({ _id: id });

  console.log(`✅ Deleted user: ${user.name} (${EMAIL})`);
  console.log(`   Appointments removed   : ${dAppts.deletedCount}`);
  console.log(`   Health records removed : ${dRecords.deletedCount}`);
  console.log(`   Notifications removed  : ${dNotifs.deletedCount}`);

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
