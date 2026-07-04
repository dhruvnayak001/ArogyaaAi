/**
 * routes/notification.routes.js
 *
 * Route table:
 *  GET    /api/v1/notifications                 → getNotifications (paginated)
 *  GET    /api/v1/notifications/unread-count    → getUnreadCount
 *  PATCH  /api/v1/notifications/read-all        → markAllAsRead
 *  PATCH  /api/v1/notifications/:id/read        → markAsRead
 *  DELETE /api/v1/notifications/:id             → deleteNotification
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');
const { param, query } = require('express-validator');
const validate = require('../middleware/validate.middleware');

/* All routes require authentication */
router.use(protect);

/* Specific paths BEFORE /:id */
router.get('/unread-count',          ctrl.getUnreadCount);
router.patch('/read-all',            ctrl.markAllAsRead);

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('unreadOnly').optional().isBoolean(),
  ],
  validate,
  ctrl.getNotifications
);

router.patch(
  '/:id/read',
  param('id').isMongoId().withMessage('Invalid notification ID'),
  validate,
  ctrl.markAsRead
);

router.delete(
  '/:id',
  param('id').isMongoId().withMessage('Invalid notification ID'),
  validate,
  ctrl.deleteNotification
);

module.exports = router;
