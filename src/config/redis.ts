import Redis from 'ioredis';
import logger from '../utils/logger';

const redisUrl = process.env.REDIS_URL;
let redis: Redis | null = null;
let isConnected = false;

if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('Redis connection failed after 3 attempts. Caching/rate-limiting will fall back gracefully.');
          isConnected = false;
          return null; // Stop retrying
        }
        return Math.min(times * 100, 1000);
      },
    });

    redis.on('connect', () => {
      logger.info('Attempting to connect to Redis...');
    });

    redis.on('ready', () => {
      isConnected = true;
      logger.info('Redis client connected and ready.');
    });

    redis.on('error', (err) => {
      logger.warn(`Redis error: ${err.message}. Operating in fallback mode.`);
      isConnected = false;
    });

    redis.on('end', () => {
      isConnected = false;
      logger.warn('Redis connection closed.');
    });
  } catch (error) {
    logger.error('Failed to initialize Redis client:', error);
  }
} else {
  logger.warn('REDIS_URL is not set. Redis caching/rate-limiting is disabled.');
}

export const getRedisClient = (): Redis | null => {
  return isConnected ? redis : null;
};

export const isRedisReady = (): boolean => {
  return isConnected;
};

export default redis;
