const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['application', 'status', 'job', 'system', 'job_alert', 'message', 'billing'],
    default: 'system'
  },
  link: {
    type: String,
    default: ''
  },
  metadata: {
    type: Object,
    default: {}
  },
  read: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('notificationModel', notificationSchema);
