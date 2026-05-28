const express = require('express');
const {
  getPaystackConfig,
  initializePayment,
  verifyPayment,
  getMyPayments,
  getBillingPortal,
  retryPayment,
  downloadInvoice,
  handlePaystackWebhook
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');
const { requireBillingAccess } = require('../middleware/capabilityMiddleware');
const { validate, stringField, numberField, idField } = require('../middleware/validationMiddleware');

const router = express.Router();

router.get('/config', getPaystackConfig);
router.post('/initialize', protect, restrictTo('employer', 'jobseeker', 'admin'), requireBillingAccess, validate({
  body:[
    numberField('amount',{min:1}),
    numberField('amountSubunit',{min:100}),
    stringField('currency',{maxLength:10}),
    stringField('purpose',{enum:['job_posting','featured_job','subscription','profile_boost']}),
    idField('jobId',{label:'job id'}),
    idField('planId',{label:'plan id'}),
    numberField('durationDays',{min:1,max:365}),
    stringField('callbackUrl',{maxLength:500})
  ]
}), initializePayment);
router.get('/verify/:reference', protect, validate({
  params:[stringField('reference',{required:true,minLength:6,maxLength:255})]
}), verifyPayment);
router.get('/history', protect, requireBillingAccess, getMyPayments);
router.get('/portal', protect, requireBillingAccess, getBillingPortal);
router.get('/invoices/:paymentId/download', protect, requireBillingAccess, validate({
  params:[idField('paymentId',{required:true,label:'payment id'})]
}), downloadInvoice);
router.post('/:paymentId/retry', protect, requireBillingAccess, validate({
  params:[idField('paymentId',{required:true,label:'payment id'})]
}), retryPayment);
router.post('/webhook', handlePaystackWebhook);

module.exports = router;
