const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel',
    required: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'jobModel'
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'pricingPlanModel'
  },
  purpose: {
    type: String,
    enum: ['job_posting', 'featured_job', 'subscription', 'profile_boost'],
    default: 'job_posting'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'abandoned', 'retrying', 'cancelled'],
    default: 'pending'
  },
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  failureReason: {
    type: String,
    default: ''
  },
  retryCount: {
    type: Number,
    default: 0
  },
  webhookEvents: {
    type: [String],
    default: []
  },
  lastRetriedAt: {
    type: Date
  },
  nextRetryAt: {
    type: Date
  },
  billingPeriodStart: {
    type: Date
  },
  billingPeriodEnd: {
    type: Date
  },
  authorizationUrl: {
    type: String
  },
  accessCode: {
    type: String
  },
  paystackId: {
    type: String
  },
  paidAt: {
    type: Date
  },
  channel: {
    type: String
  },
  gatewayResponse: {
    type: String
  },
  metadata: {
    type: Object,
    default: {}
  },
  rawResponse: {
    type: Object
  }
}, { timestamps: true });

module.exports = mongoose.model('paymentModel', paymentSchema);
