const { Sequelize } = require('sequelize');

const sequelize = process.env.DATABASE_URL 
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false // Required for Render/Heroku/AWS RDS
        }
      }
    })
  : new Sequelize(
      process.env.DB_NAME || 'ocr_system',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || 'postgres',
      {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
      }
    );

// Test connection
sequelize.authenticate()
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database connection failed:', err));

module.exports = sequelize;
