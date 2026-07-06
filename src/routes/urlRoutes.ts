import { Router } from 'express';
import { shortenUrl, listUrls, deleteUrl } from '../controllers/urlController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @openapi
 * /api/url/shorten:
 *   post:
 *     summary: Shorten a URL
 *     description: Converts a long original URL into a short code. Optionally supports auth to link URLs to a dashboard.
 *     tags: [URL Shortener]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originalUrl
 *             properties:
 *               originalUrl:
 *                 type: string
 *                 example: https://github.com/snehithyerra13-cell/backend
 *               customAlias:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 example: my-project
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 example: 2027-12-31T23:59:59Z
 *     responses:
 *       201:
 *         description: Created short link successfully
 *       400:
 *         description: Invalid parameters or formatting
 *       409:
 *         description: Custom alias already exists
 *       500:
 *         description: Internal server error
 */
router.post('/shorten', apiLimiter, optionalAuthMiddleware, shortenUrl);

/**
 * @openapi
 * /api/url/my-links:
 *   get:
 *     summary: Get all URLs created by the authenticated user
 *     tags: [URL Shortener]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of links retrieved successfully
 *       401:
 *         description: Access denied or invalid token
 *       500:
 *         description: Internal server error
 */
router.get('/my-links', authMiddleware, listUrls);

/**
 * @openapi
 * /api/url/{id}:
 *   delete:
 *     summary: Delete a shortened URL
 *     tags: [URL Shortener]
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
 *         description: Deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Link not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authMiddleware, deleteUrl);

export default router;
