const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret',
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Extract Google Profile info
      const { id, emails, displayName } = profile;
      const email = emails[0].value;

      // Find or Create user
      let user = await User.findOne({ where: { googleId: id } });

      if (!user) {
        // Also check by email to merge accounts
        user = await User.findOne({ where: { email } });
        
        if (user) {
          // Update existing user with googleId
          await user.update({ googleId: id });
        } else {
          // Create new user for first-time Google login
          user = await User.create({
            name: displayName,
            email: email,
            googleId: id,
            password: 'google-oauth-login', // Placeholder
            isEmailVerified: true
          });
        }
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
