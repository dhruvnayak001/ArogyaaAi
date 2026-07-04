require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB.');
  
  console.log('Dropping entire database...');
  await mongoose.connection.db.dropDatabase();
  console.log(' - Database dropped');

  console.log('\nSeeding doctors...');
  // We can just require the seed file. The seed file usually has its own connect/disconnect logic though.
  // Wait, let's just spawn a child process to run the seed script to be safe.
  const { execSync } = require('child_process');
  execSync('node src/seed/doctors.seed.js', { stdio: 'inherit' });

  console.log('\n✅ Database completely reset and doctors re-seeded.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
