const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel'
  },
  actorName: {
    type: String,
    default: ''
  },
  actorRole: {
    type: String,
    default: ''
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel'
  },
  action: {
    type: String,
    required: true
  },
  entityType: {
    type: String,
    required: true
  },
  entityId: {
    type: String,
    default: ''
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'jobModel'
  },
  applicationId: {
    type: String,
    default: ''
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserModel'
  },
  metadata: {
    type: Object,
    default: {}
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('auditLogModel', auditLogSchema);
