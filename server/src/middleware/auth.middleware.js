/**
 * middleware/auth.middleware.js
 * JWT authentication and authorization middleware
 */

'use strict';

const jwt    = require('jsonwebtoken');
const User   = require('../models/User.model');
const logger = require('../config/logger');

/**
 * protect — Verifies JWT access token from Authorization header
 * Attaches `req.user` on success
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please log in.',
      });
    }

    // Verify access token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Access token expired',
          code:    'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    // Fetch user (verify still exists and active) — .lean() reduces hydration overhead
    // on this hot path. req.user is read-only across all routes; nothing calls .save() on it.
    const user = await User.findById(decoded.id)
      .select('name email role avatar isActive preferences dateOfBirth doctorProfile.specialization doctorProfile.isVerified doctorProfile.consultationModes')
      .lean();
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or deactivated',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error('Auth middleware error:', err);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

/**
 * authorize — Role-based access control
 * Usage: authorize('doctor'), authorize('admin', 'doctor')
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user?.role}' is not authorized to access this resource`,
    });
  }
  next();
};

/**
 * optionalAuth — Attaches user if token is present but doesn't block if not
 * Useful for routes that work differently for auth vs anon users
 */
const optionalAuth = async (req, _res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      req.user = await User.findById(decoded.id).select('-password -refreshToken');
    }
  } catch {
    // Silently ignore — token is optional
  }
  next();
};

module.exports = { protect, authorize, optionalAuth };
