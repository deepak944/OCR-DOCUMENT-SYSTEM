// In-memory activity tracking (temporary - will be replaced with database)
class ActivityStore {
  constructor() {
    this.activities = [];
    this.nextId = 1;
  }

  create(activityData) {
    const activity = {
      id: this.nextId++,
      ...activityData,
      timestamp: new Date().toISOString(),
    };
    this.activities.push(activity);
    return activity;
  }

  findByUserId(userId, limit = 50) {
    return this.activities
      .filter(activity => activity.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getAll(limit = 100) {
    return this.activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  deleteById(id, userId) {
    const index = this.activities.findIndex(
      (a) => a.id === id && a.userId === userId
    );
    if (index === -1) return null;
    return this.activities.splice(index, 1)[0];
  }

  deleteByUserId(userId) {
    this.activities = this.activities.filter(activity => activity.userId !== userId);
  }
}

const activityStore = new ActivityStore();

module.exports = activityStore;
