import { Response } from 'express';
import prisma from '../config/db';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

/**
 * Get click analytics for a specific shortened URL.
 */
export async function getUrlAnalytics(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check ownership of the URL
    const url = await prisma.url.findFirst({
      where: { id, userId },
    });

    if (!url) {
      return res.status(404).json({ error: 'Short URL not found or unauthorized.' });
    }

    // Fetch all clicks for this URL
    const clicks = await prisma.click.findMany({
      where: { urlId: id },
      orderBy: { clickedAt: 'asc' },
    });

    // Aggregations
    const clicksOverTime: Record<string, number> = {};
    const browserDist: Record<string, number> = {};
    const osDist: Record<string, number> = {};
    const deviceDist: Record<string, number> = {};
    const countryDist: Record<string, number> = {};
    const referrerDist: Record<string, number> = {};

    clicks.forEach((click) => {
      // Group by date (YYYY-MM-DD)
      const dateStr = click.clickedAt.toISOString().split('T')[0];
      clicksOverTime[dateStr] = (clicksOverTime[dateStr] || 0) + 1;

      // Group by Browser
      const browser = click.browser || 'Unknown';
      browserDist[browser] = (browserDist[browser] || 0) + 1;

      // Group by OS
      const os = click.os || 'Unknown';
      osDist[os] = (osDist[os] || 0) + 1;

      // Group by Device
      const device = click.device || 'Desktop';
      deviceDist[device] = (deviceDist[device] || 0) + 1;

      // Group by Country
      const country = click.country || 'Unknown';
      countryDist[country] = (countryDist[country] || 0) + 1;

      // Group by Referrer
      const ref = click.referrer || 'Direct';
      referrerDist[ref] = (referrerDist[ref] || 0) + 1;
    });

    return res.status(200).json({
      url: {
        id: url.id,
        shortCode: url.shortCode,
        originalUrl: url.originalUrl,
        createdAt: url.createdAt,
        expiresAt: url.expiresAt,
      },
      summary: {
        totalClicks: clicks.length,
      },
      analytics: {
        clicksOverTime: Object.entries(clicksOverTime).map(([date, count]) => ({ date, count })),
        browsers: Object.entries(browserDist).map(([name, value]) => ({ name, value })),
        os: Object.entries(osDist).map(([name, value]) => ({ name, value })),
        devices: Object.entries(deviceDist).map(([name, value]) => ({ name, value })),
        countries: Object.entries(countryDist).map(([name, value]) => ({ name, value })),
        referrers: Object.entries(referrerDist).map(([name, value]) => ({ name, value })),
      },
    });
  } catch (error) {
    logger.error('Error fetching URL analytics:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
export default getUrlAnalytics;
