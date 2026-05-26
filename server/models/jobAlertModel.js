const mongoose = require('mongoose');

const jobAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel',
    required: true
  },
  keywords: {
    type: [String],
    default: []
  },
  categories: {
    type: [String],
    default: []
  },
  locations: {
    type: [String],
    default: []
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly'],
    default: 'daily'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSent: {
    type: Date,
    default: Date.now
  },
  sentJobs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'jobModel'
  }]
}, { timestamps: true });

module.exports = mongoose.model('jobAlertModel', jobAlertSchema);
