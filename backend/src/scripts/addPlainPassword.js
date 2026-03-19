const sequelize = require('../config/database');

async function addColumn() {
  try {
    await sequelize.query('ALTER TABLE users ADD COLUMN "plainPassword" VARCHAR(255);');
    console.log('✅ Column successfully added');
    process.exit(0);
  } catch (err) {
    if (err.message.includes('already exists')) {
        console.log('✅ Column already exists');
        process.exit(0);
    }
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

addColumn();
