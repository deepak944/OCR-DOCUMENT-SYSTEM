const Redis = require('ioredis');
const config = require('../config/config');

const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT
});

const addOCRJob = async (jobData) => {
  // Push job to a simple Redis list
  const jobString = JSON.stringify({
    ...jobData,
    timestamp: Date.now()
  });
  return await redis.lpush('ocr_queue', jobString);
};

module.exports = {
  addOCRJob
};
