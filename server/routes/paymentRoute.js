const express = require('express');
const {
  getPaystackConfig,
  initializePayment,
  verifyPayment,
  getMyPayments,
  getBillingPortal,
  retryPayment,
  handlePaystackWebhook
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/config', getPaystackConfig);
router.post('/initialize', protect, restrictTo('employer', 'jobseeker', 'admin'), initializePayment);
router.get('/verify/:reference', protect, verifyPayment);
router.get('/history', protect, getMyPayments);
router.get('/portal', protect, getBillingPortal);
router.post('/:paymentId/retry', protect, retryPayment);
router.post('/webhook', handlePaystackWebhook);

module.exports = router;
