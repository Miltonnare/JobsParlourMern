const mongoose = require('mongoose');

const pricingPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['employer', 'jobseeker'],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  interval: {
    type: String,
    enum: ['free', 'one_time', 'monthly', 'yearly'],
    default: 'monthly'
  },
  features: [String],
  limits: {
    type: Object,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('pricingPlanModel', pricingPlanSchema);
