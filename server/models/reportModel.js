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
  status: {
    type: String,
    enum: ['open', 'reviewing', 'resolved', 'dismissed'],
    default: 'open'
  }
}, { timestamps: true });

module.exports = mongoose.model('reportModel', reportSchema);
