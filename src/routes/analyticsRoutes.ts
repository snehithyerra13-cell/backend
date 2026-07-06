import { Router } from 'express';
import { getUrlAnalytics } from '../controllers/analyticsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/analytics/{id}:
 *   get:
 *     summary: Retrieve click analytics for a specific URL
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The database ID of the URL entry
 *     responses:
 *       200:
 *         description: Analytics summary and details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: URL not found or unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authMiddleware, getUrlAnalytics);

export default router;
