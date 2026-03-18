// In-memory session/token blacklist storage
class SessionStore {
  constructor() {
    this.blacklistedTokens = new Set();
    this.userSessions = new Map(); // userId -> Set of tokens
  }

  blacklistToken(token) {
    this.blacklistedTokens.add(token);
  }

  isTokenBlacklisted(token) {
    return this.blacklistedTokens.has(token);
  }

  addUserSession(userId, token) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(token);
  }

  removeUserSession(userId, token) {
    if (this.userSessions.has(userId)) {
      this.userSessions.get(userId).delete(token);
    }
  }

  getUserSessions(userId) {
    return this.userSessions.get(userId) || new Set();
  }

  clearUserSessions(userId) {
    if (this.userSessions.has(userId)) {
      const tokens = this.userSessions.get(userId);
      tokens.forEach(token => this.blacklistToken(token));
      this.userSessions.delete(userId);
    }
  }

  // Clean up expired tokens periodically
  cleanup() {
    // In production with DB, this would query and remove expired tokens
    // For now, we rely on JWT expiration validation
  }
}

const sessionStore = new SessionStore();

module.exports = sessionStore;
