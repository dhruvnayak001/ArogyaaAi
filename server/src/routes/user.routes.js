/**
 * routes/user.routes.js
 *
 * Route table:
 *  GET    /api/v1/users/profile        → getProfile
 *  PUT    /api/v1/users/profile        → updateProfile
 *  DELETE /api/v1/users/me            → deleteAccount
 *  PATCH  /api/v1/users/preferences   → updatePreferences
 */

'use strict';

const express      = require('express');
const router       = express.Router();
const { protect }  = require('../middleware/auth.middleware');
const catchAsync   = require('../utils/catchAsync');
const User         = require('../models/User.model');
const AppError     = require('../utils/AppError');
const { body }     = require('express-validator');
const validate     = require('../middleware/validate.middleware');

router.use(protect);

/* GET /users/profile */
router.get('/profile', catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found.', 404);
  res.status(200).json({ success: true, data: { user } });
}));

/* PUT /users/profile */
router.put('/profile',
  [
    body('name').optional().trim().isLength({ min: 2, max: 60 }),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('bloodGroup').optional().isIn(['A+','A-','B+','B-','AB+','AB-','O+','O-']),
    body('dateOfBirth').optional().isISO8601(),
    body('gender').optional().isIn(['male','female','other','prefer_not_to_say']),
  ],
  validate,
  catchAsync(async (req, res) => {
    const ALLOWED = ['name','phone','address','bloodGroup','dateOfBirth','gender','allergies','chronicConditions','emergencyContact'];
    const updates = {};
    ALLOWED.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, data: { user } });
  })
);

/* PATCH /users/preferences */
router.patch('/preferences',
  catchAsync(async (req, res) => {
    const ALLOWED_PREFS = [
      'emailNotifications','pushNotifications',
      'emergencyAlerts','appointmentReminders','shareWithDoctors',
    ];
    const prefUpdates = {};
    ALLOWED_PREFS.forEach((p) => {
      if (req.body[p] !== undefined) prefUpdates[`preferences.${p}`] = !!req.body[p];
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: prefUpdates },
      { new: true }
    );
    res.status(200).json({ success: true, data: { preferences: user.preferences } });
  })
);

/* DELETE /users/me — soft delete */
router.delete('/me', catchAsync(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    isActive:     false,
    refreshToken: undefined,
  });
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  res.status(200).json({ success: true, message: 'Account deactivated' });
}));

module.exports = router;
