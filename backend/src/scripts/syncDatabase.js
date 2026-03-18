const { sequelize } = require('../models');

async function syncDatabase() {
  try {
    console.log('🔄 Syncing database...');
    
    // This will create tables if they don't exist
    await sequelize.sync({ alter: true });
    
    console.log('✅ Database synced successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    process.exit(1);
  }
}

syncDatabase();
