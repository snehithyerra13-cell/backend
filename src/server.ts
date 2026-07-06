import app from './app';
import logger from './utils/logger';
import prisma from './config/db';
import { isRedisReady } from './config/redis';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    logger.info('Verifying database connection...');
    await prisma.$connect();
    logger.info('Database connection established successfully.');

    // Small delay to let Redis connection events trigger and resolve status
    setTimeout(() => {
      if (isRedisReady()) {
        logger.info('System Cache: Redis is ACTIVE.');
      } else {
        logger.warn('System Cache: Redis is INACTIVE (Operating in fallback mode).');
      }
    }, 1000);

    app.listen(PORT, () => {
      logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      logger.info(`API Docs available at http://localhost:${PORT}/docs`);
    });
  } catch (error) {
    logger.error('Failed to start the server:', error);
    process.exit(1);
  }
}

startServer();
