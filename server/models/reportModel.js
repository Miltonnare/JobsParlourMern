const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'jobModel',
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel',
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['spam', 'scam', 'abuse', 'misleading', 'other'],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['open', 'reviewing', 'resolved', 'dismissed'],
    default: 'open'
  }
}, { timestamps: true });

module.exports = mongoose.model('reportModel', reportSchema);
