import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import logger from './utils/logger';
import authRoutes from './routes/authRoutes';
import urlRoutes from './routes/urlRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import { redirectUrl } from './controllers/urlController';
import { setupSwagger } from './config/swagger';

dotenv.config();

const app: Express = express();

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Set up Swagger API Documentation
setupSwagger(app);

// Host the frontend static files at the root
app.use(express.static(path.join(process.cwd(), 'public')));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/url', urlRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Clean redirection route (placed at the bottom to avoid blocking static assets or other endpoints)
app.get('/:shortCode', redirectUrl);

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled Exception:', err);
  return res.status(500).json({
    error: 'Internal server error.',
    message: process.env.NODE_ENV !== 'production' ? err.message : undefined,
  });
});

export default app;
