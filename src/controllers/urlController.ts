import { Response } from 'express';
import validator from 'validator';
import useragent from 'useragent';
import requestIp from 'request-ip';
import prisma from '../config/db';
import redis, { isRedisReady } from '../config/redis';
import { generateRandomShortCode } from '../utils/base62';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const DEFAULT_CACHE_TTL = 86400; // 24 hours in seconds

/**
 * Helper to record click analytics asynchronously.
 * Does not block the HTTP redirect response.
 */
async function recordClickAsync(urlId: string, ip: string | null, uaString: string | null, referrer: string | null, vercelCountry: string | null) {
  try {
    let device = 'Desktop';
    let browser = 'Unknown';
    let os = 'Unknown';

    if (uaString) {
      const agent = useragent.parse(uaString);
      browser = agent.toAgent();
      os = agent.os.toString();
      
      // Basic device detection based on User-Agent keywords
      const lowerUa = uaString.toLowerCase();
      if (lowerUa.includes('mobile') || lowerUa.includes('android') || lowerUa.includes('iphone')) {
        device = 'Mobile';
      } else if (lowerUa.includes('tablet') || lowerUa.includes('ipad')) {
        device = 'Tablet';
      } else if (lowerUa.includes('bot') || lowerUa.includes('crawler') || lowerUa.includes('spider')) {
        device = 'Bot';
      }
    }

    // Determine country (Vercel provides country header, fall back to IP-based country mock or Unknown)
    const country = vercelCountry || 'Unknown';

    await prisma.click.create({
      data: {
        urlId,
        ip,
        userAgent: uaString,
        referrer: referrer || 'Direct',
        country,
        device,
        browser,
        os,
      },
    });
    logger.debug(`Click recorded asynchronously for URL ID: ${urlId}`);
  } catch (error) {
    logger.error(`Error recording click analytics: ${(error as Error).message}`);
  }
}

/**
 * Create a shortened URL.
 */
export async function shortenUrl(req: AuthenticatedRequest, res: Response) {
  try {
    const { originalUrl, customAlias, expiresAt } = req.body;
    const userId = req.user?.id || null;

    if (!originalUrl) {
      return res.status(400).json({ error: 'Original URL is required.' });
    }

    if (!validator.isURL(originalUrl, { require_protocol: true })) {
      return res.status(400).json({ error: 'Invalid original URL. Ensure it starts with http:// or https://' });
    }

    let shortCode = '';

    // Handle custom alias
    if (customAlias) {
      // Validate custom alias format (alphanumeric, hyphens, underscores, 3-30 chars)
      const aliasRegex = /^[a-zA-Z0-9_-]{3,30}$/;
      if (!aliasRegex.test(customAlias)) {
        return res.status(400).json({ error: 'Custom alias must be 3-30 characters long and contain only letters, numbers, hyphens, and underscores.' });
      }

      // Reserved words validation
      const reserved = ['api', 'auth', 'docs', 'analytics', 'health', 'users', 'urls'];
      if (reserved.includes(customAlias.toLowerCase())) {
        return res.status(400).json({ error: 'This alias is reserved and cannot be used.' });
      }

      // Check for collision in DB
      const existing = await prisma.url.findUnique({
        where: { shortCode: customAlias },
      });
      if (existing) {
        return res.status(409).json({ error: 'Custom alias is already taken.' });
      }
      shortCode = customAlias;
    } else {
      // Generate a unique 6-character short code with collision detection (up to 5 retries)
      let attempts = 0;
      let isUnique = false;
      while (!isUnique && attempts < 5) {
        shortCode = generateRandomShortCode(6);
        
        // Quick check in Redis first
        let cacheExists = false;
        if (isRedisReady()) {
          const cached = await redis?.get(`url:${shortCode}`);
          if (cached) cacheExists = true;
        }

        if (!cacheExists) {
          const dbExists = await prisma.url.findUnique({
            where: { shortCode },
          });
          if (!dbExists) {
            isUnique = true;
          }
        }
        attempts++;
      }

      if (!isUnique) {
        logger.error('Failed to generate unique shortcode after 5 attempts.');
        return res.status(500).json({ error: 'Server busy. Please try again.' });
      }
    }

    // Validate expiration date
    let parsedExpiry: Date | null = null;
    if (expiresAt) {
      parsedExpiry = new Date(expiresAt);
      if (isNaN(parsedExpiry.getTime())) {
        return res.status(400).json({ error: 'Invalid expiration date format.' });
      }
      if (parsedExpiry.getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Expiration date must be in the future.' });
      }
    }

    // Create DB entry
    const url = await prisma.url.create({
      data: {
        originalUrl,
        shortCode,
        customAlias: customAlias || null,
        expiresAt: parsedExpiry,
        userId,
      },
    });

    // Cache in Redis if Redis is active
    if (isRedisReady() && redis) {
      const cacheValue = JSON.stringify({
        id: url.id,
        originalUrl: url.originalUrl,
        expiresAt: url.expiresAt ? url.expiresAt.toISOString() : null,
      });

      let ttl = DEFAULT_CACHE_TTL;
      if (parsedExpiry) {
        ttl = Math.max(1, Math.floor((parsedExpiry.getTime() - Date.now()) / 1000));
      }
      await redis.set(`url:${shortCode}`, cacheValue, 'EX', ttl);
      logger.info(`Cached shortcode: ${shortCode} in Redis (TTL: ${ttl}s)`);
    }

    logger.info(`Short URL created: ${shortCode} -> ${originalUrl}`);

    const scheme = req.secure ? 'https' : 'http';
    const host = req.get('host');
    const shortenedUrl = `${scheme}://${host}/${shortCode}`;

    return res.status(201).json({
      id: url.id,
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      shortenedUrl,
      customAlias: url.customAlias,
      expiresAt: url.expiresAt,
      createdAt: url.createdAt,
    });
  } catch (error) {
    logger.error('Error shortening URL:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * Handle short URL redirection.
 */
export async function redirectUrl(req: AuthenticatedRequest, res: Response) {
  try {
    const { shortCode } = req.params;
    const clientIp = requestIp.getClientIp(req);
    const uaString = req.headers['user-agent'] || null;
    const referrer = req.headers.referer || req.headers.referrer || null;
    // Vercel routes geolocation country code in x-vercel-ip-country header
    const vercelCountry = req.headers['x-vercel-ip-country'] as string || null;

    let urlData: { id: string; originalUrl: string; expiresAt: string | Date | null } | null = null;

    // 1. Try Cache Lookup (Redis)
    if (isRedisReady() && redis) {
      const cached = await redis.get(`url:${shortCode}`);
      if (cached) {
        urlData = JSON.parse(cached);
        logger.info(`Redis cache HIT for shortcode: ${shortCode}`);
      }
    }

    // 2. Database Lookup on Cache Miss
    if (!urlData) {
      logger.info(`Redis cache MISS for shortcode: ${shortCode}. Querying Database.`);
      const dbUrl = await prisma.url.findUnique({
        where: { shortCode },
      });

      if (dbUrl) {
        urlData = {
          id: dbUrl.id,
          originalUrl: dbUrl.originalUrl,
          expiresAt: dbUrl.expiresAt,
        };

        // Cache the active link
        if (isRedisReady() && redis) {
          const cacheValue = JSON.stringify(urlData);
          let ttl = DEFAULT_CACHE_TTL;
          if (dbUrl.expiresAt) {
            ttl = Math.max(1, Math.floor((new Date(dbUrl.expiresAt).getTime() - Date.now()) / 1000));
          }
          await redis.set(`url:${shortCode}`, cacheValue, 'EX', ttl);
        }
      }
    }

    // 3. Handle Link Not Found
    if (!urlData) {
      return res.status(404).send('<h1>404 Not Found</h1><p>The short link you are looking for does not exist.</p>');
    }

    // 4. Handle Expired Link (Lazy Deletion)
    if (urlData.expiresAt) {
      const isExpired = new Date(urlData.expiresAt).getTime() <= Date.now();
      if (isExpired) {
        logger.info(`Link ${shortCode} has expired. Performing lazy deletion.`);
        
        // Remove asynchronously from Redis
        if (isRedisReady() && redis) {
          redis.del(`url:${shortCode}`).catch(err => logger.error(`Cache del error: ${err}`));
        }

        // Delete from database
        await prisma.url.delete({
          where: { id: urlData.id },
        }).catch(err => logger.error(`Database lazy-delete error: ${err}`));

        return res.status(410).send('<h1>410 Gone</h1><p>This short link has expired and is no longer active.</p>');
      }
    }

    // 5. Log click analytics asynchronously
    recordClickAsync(urlData.id, clientIp, uaString, referrer, vercelCountry);

    // 6. Perform Redirect (302 Found)
    return res.redirect(302, urlData.originalUrl);
  } catch (error) {
    logger.error('Redirect handler error:', error);
    return res.status(500).send('<h1>500 Internal Server Error</h1><p>Something went wrong on our end.</p>');
  }
}

/**
 * List all URLs created by the authenticated user.
 */
export async function listUrls(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const urls = await prisma.url.findMany({
      where: { userId },
      include: {
        _count: {
          select: { clicks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const scheme = req.secure ? 'https' : 'http';
    const host = req.get('host');

    const formattedUrls = urls.map(url => ({
      id: url.id,
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      shortenedUrl: `${scheme}://${host}/${url.shortCode}`,
      customAlias: url.customAlias,
      expiresAt: url.expiresAt,
      createdAt: url.createdAt,
      clickCount: url._count.clicks,
    }));

    return res.status(200).json(formattedUrls);
  } catch (error) {
    logger.error('Error listing URLs:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * Delete a URL.
 */
export async function deleteUrl(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const url = await prisma.url.findFirst({
      where: { id, userId },
    });

    if (!url) {
      return res.status(404).json({ error: 'Short URL not found or unauthorized.' });
    }

    // Invalidate Redis cache
    if (isRedisReady() && redis) {
      await redis.del(`url:${url.shortCode}`);
    }

    // Delete from DB (clicks are cascade-deleted due to DB definition)
    await prisma.url.delete({
      where: { id },
    });

    logger.info(`URL deleted: ${url.shortCode}`);
    return res.status(200).json({ message: 'URL and its analytics deleted successfully.' });
  } catch (error) {
    logger.error('Error deleting URL:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
