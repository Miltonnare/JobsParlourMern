const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel'
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'jobModel'
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId
  },
  conversationKey: {
    type: String,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('messageModel', messageSchema);
