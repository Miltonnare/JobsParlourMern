const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'pricingPlanModel',
    required: true
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'paymentModel'
  },
  role: {
    type: String,
    enum: ['employer', 'jobseeker'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'trialing', 'past_due', 'cancelled', 'expired'],
    default: 'active'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  },
  usage: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('subscriptionModel', subscriptionSchema);
