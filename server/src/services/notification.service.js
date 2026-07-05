/**
 * services/notification.service.js
 * Business logic for in-app notification management
 */

'use strict';

const Notification = require('../models/Notification.model');
const logger       = require('../config/logger');

/* ════════════════════════════════════════
   CREATE
   ════════════════════════════════════════ */

/**
 * Create a single notification.
 * Non-blocking (fire-and-forget callers) — always resolves; logs on failure.
 * Callers that need failures to propagate (e.g. the BullMQ worker, so a
 * retry actually happens) should check for a null return and throw.
 *
 * @param {string|ObjectId} recipientId
 * @param {string}          type        - Must match NOTIFICATION_TYPES enum
 * @param {string}          title
 * @param {string}          message
 * @param {object}          [data={}]   - Extra contextual payload
 * @param {string}          [link]      - Frontend route to navigate to
 * @param {string|null}     [dedupeKey] - Idempotency key; when provided, a
 *                                        retry with the same key upserts the
 *                                        existing doc instead of duplicating it.
 * @returns {Promise<Document|null>}
 */
const createNotification = async (recipientId, type, title, message, data = {}, link = null, dedupeKey = null) => {
  try {
    if (dedupeKey) {
      const notif = await Notification.findOneAndUpdate(
        { dedupeKey },
        { $setOnInsert: { recipient: recipientId, type, title, message, data, link, dedupeKey } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      logger.info(`[NOTIF] Upserted "${type}" for user ${recipientId} (dedupeKey=${dedupeKey})`);
      return notif;
    }

    const notif = await Notification.create({
      recipient: recipientId,
      type,
      title,
      message,
      data,
      link,
    });
    logger.info(`[NOTIF] Created "${type}" for user ${recipientId}`);
    return notif;
  } catch (err) {
    /* A concurrent upsert racing on the same dedupeKey's unique index can
       throw 11000 instead of resolving via findOneAndUpdate's own retry —
       treat that as a successful dedupe, not a failure. */
    if (err.code === 11000 && dedupeKey) {
      logger.info(`[NOTIF] Duplicate suppressed for dedupeKey=${dedupeKey}`);
      return Notification.findOne({ dedupeKey });
    }
    logger.error(`[NOTIF] Failed to create notification: ${err.message}`);
    return null;
  }
};

/* ════════════════════════════════════════
   READ
   ════════════════════════════════════════ */

/**
 * Get paginated notifications for a user (newest first).
 */
const getNotifications = async (userId, { page = 1, limit = 20, unreadOnly = false } = {}) => {
  const query = { recipient: userId };
  if (unreadOnly) query.isRead = false;

  const skip  = (page - 1) * limit;
  const total = await Notification.countDocuments(query);

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    notifications,
    pagination: {
      total,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(total / limit),
      hasMore:    skip + notifications.length < total,
    },
  };
};

/**
 * Get unread count for a user.
 */
const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ recipient: userId, isRead: false });
};

/* ════════════════════════════════════════
   MARK AS READ
   ════════════════════════════════════════ */

/**
 * Mark a single notification as read (validates ownership).
 */
const markAsRead = async (userId, notifId) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: notifId, recipient: userId },
    { isRead: true },
    { new: true }
  );
  return notif;
};

/**
 * Mark ALL unread notifications as read for a user.
 */
const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true }
  );
  logger.info(`[NOTIF] Marked ${result.modifiedCount} notifications read for user ${userId}`);
  return result.modifiedCount;
};

/* ════════════════════════════════════════
   DELETE
   ════════════════════════════════════════ */

/**
 * Delete a single notification (validates ownership).
 */
const deleteNotification = async (userId, notifId) => {
  const notif = await Notification.findOneAndDelete({ _id: notifId, recipient: userId });
  return !!notif;
};

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
