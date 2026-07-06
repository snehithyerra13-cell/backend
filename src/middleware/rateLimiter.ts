import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisReady } from '../config/redis';
import logger from '../utils/logger';

// Create a function to determine the store dynamically
const getLimiterStore = () => {
  if (isRedisReady()) {
    const client = getRedisClient();
    if (client) {
      logger.info('Rate limiter: Using Redis Store.');
      return new RedisStore({
        // @ts-ignore
        sendCommand: (...args: string[]) => {
          const command = args[0];
          const rest = args.slice(1);
          return client.call(command, ...rest);
        },
      });
    }
  }
  logger.warn('Rate limiter: Redis not ready, falling back to local In-Memory Store.');
  return undefined; // express-rate-limit defaults to MemoryStore
};

// Standard rate limiter: max 100 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  // We use a function to retrieve the store, but express-rate-limit resolves this on middleware initialization.
  // To handle runtime switches, we check connectivity on start.
  store: getLimiterStore(),
});

// Stricter rate limiter for authentication: max 15 requests per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  store: getLimiterStore(),
});
