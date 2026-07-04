/**
 * routes/chat.routes.js
 *
 * Route table:
 *  GET    /api/v1/chat/sessions                          → getSessions
 *  POST   /api/v1/chat/sessions                          → createSession
 *  GET    /api/v1/chat/sessions/:sessionId               → getSession
 *  DELETE /api/v1/chat/sessions/:sessionId               → deleteSession
 *  POST   /api/v1/chat/sessions/:sessionId/messages      → sendMessage
 *  GET    /api/v1/chat/sessions/:sessionId/messages      → getMessages
 *  GET    /api/v1/chat/sessions/:sessionId/summary       → getSessionSummary
 *  POST   /api/v1/chat/emergency-analysis                → analyzeEmergency
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const chatCtrl   = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');
const { body, param } = require('express-validator');
const validate   = require('../middleware/validate.middleware');

/* All chat routes require auth */
router.use(protect);

/* Session routes */
router.get('/',  chatCtrl.getSessions);  // Note: mounted at /chat/sessions in index.js
router.post('/sessions', chatCtrl.createSession);
router.get('/sessions',  chatCtrl.getSessions);

router.get('/sessions/:sessionId',
  param('sessionId').isMongoId().withMessage('Invalid session ID'),
  validate,
  chatCtrl.getSession
);

router.delete('/sessions/:sessionId',
  param('sessionId').isMongoId().withMessage('Invalid session ID'),
  validate,
  chatCtrl.deleteSession
);

/* Message routes */
router.post('/sessions/:sessionId/messages',
  param('sessionId').isMongoId().withMessage('Invalid session ID'),
  body('content')
    .trim()
    .notEmpty().withMessage('Message content is required')
    .isLength({ max: 5000 }).withMessage('Message is too long (max 5000 chars)'),
  validate,
  chatCtrl.sendMessage
);

router.get('/sessions/:sessionId/messages',
  param('sessionId').isMongoId().withMessage('Invalid session ID'),
  validate,
  chatCtrl.getMessages
);

router.get('/sessions/:sessionId/summary',
  param('sessionId').isMongoId().withMessage('Invalid session ID'),
  validate,
  chatCtrl.getSessionSummary
);

/* Emergency analysis */
router.post('/emergency-analysis',
  body('symptoms')
    .trim()
    .notEmpty().withMessage('Symptoms description is required')
    .isLength({ max: 2000 }).withMessage('Symptoms text is too long'),
  validate,
  chatCtrl.analyzeEmergency
);

module.exports = router;
