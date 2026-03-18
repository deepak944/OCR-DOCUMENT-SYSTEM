const sequelize = require('../config/database');
const User = require('./User');
const Activity = require('./Activity');
const Session = require('./Session');

// Define relationships
User.hasMany(Activity, {
  foreignKey: 'userId',
  as: 'activities',
});

Activity.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

User.hasMany(Session, {
  foreignKey: 'userId',
  as: 'sessions',
});

Session.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

module.exports = {
  sequelize,
  User,
  Activity,
  Session,
};
