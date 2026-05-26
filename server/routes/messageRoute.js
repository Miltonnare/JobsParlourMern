const express = require('express');
const {
  sendMessage,
  getConversations,
  getConversationThread,
  markConversationRead
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect, restrictTo('employer', 'jobseeker'));
router.get('/', getConversations);
router.post('/', sendMessage);
router.get('/:jobId/:participantId', getConversationThread);
router.patch('/:jobId/:participantId/read', markConversationRead);

module.exports = router;
