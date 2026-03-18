// In-memory user storage (temporary - will be replaced with database)
class UserStore {
  constructor() {
    this.users = [];
    this.nextId = 1;
  }

  create(userData) {
    const user = {
      id: this.nextId++,
      ...userData,
      createdAt: new Date().toISOString(),
    };
    this.users.push(user);
    return user;
  }

  findByEmail(email) {
    return this.users.find(user => user.email === email);
  }

  findById(id) {
    return this.users.find(user => user.id === id);
  }

  getAll() {
    return this.users;
  }

  update(id, updates) {
    const index = this.users.findIndex(user => user.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...updates };
      return this.users[index];
    }
    return null;
  }

  delete(id) {
    const index = this.users.findIndex(user => user.id === id);
    if (index !== -1) {
      return this.users.splice(index, 1)[0];
    }
    return null;
  }
}

// Singleton instance
const userStore = new UserStore();

module.exports = userStore;
