/**
 * controllers/notification.controller.js
 * HTTP layer for notification management
 */

'use strict';

const notifService = require('../services/notification.service');
const catchAsync   = require('../utils/catchAsync');
const AppError     = require('../utils/AppError');

/* GET /notifications?page=1&limit=20&unreadOnly=false */
const getNotifications = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;

  const result = await notifService.getNotifications(req.user._id, {
    page:       parseInt(page, 10),
    limit:      parseInt(limit, 10),
    unreadOnly: unreadOnly === 'true',
  });

  res.status(200).json({ success: true, data: result });
});

/* GET /notifications/unread-count */
const getUnreadCount = catchAsync(async (req, res) => {
  const count = await notifService.getUnreadCount(req.user._id);
  res.status(200).json({ success: true, data: { count } });
});

/* PATCH /notifications/read-all */
const markAllAsRead = catchAsync(async (req, res) => {
  const count = await notifService.markAllAsRead(req.user._id);
  res.status(200).json({
    success: true,
    message: `Marked ${count} notification(s) as read`,
    data:    { count },
  });
});

/* PATCH /notifications/:id/read */
const markAsRead = catchAsync(async (req, res) => {
  const notif = await notifService.markAsRead(req.user._id, req.params.id);
  if (!notif) throw new AppError('Notification not found.', 404);
  res.status(200).json({ success: true, data: { notification: notif } });
});

/* DELETE /notifications/:id */
const deleteNotification = catchAsync(async (req, res) => {
  const deleted = await notifService.deleteNotification(req.user._id, req.params.id);
  if (!deleted) throw new AppError('Notification not found.', 404);
  res.status(200).json({ success: true, message: 'Notification deleted.' });
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  deleteNotification,
};
