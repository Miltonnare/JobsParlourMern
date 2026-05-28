const AuditLog = require('../models/auditLogModel');

const resolveCompanyId = (currentUser) => {
  if (!currentUser) return undefined;
  return currentUser.companyId || currentUser._id;
};

const createAuditLog = async (req, entry = {}) => {
  try {
    await AuditLog.create({
      actor: req?.user?._id,
      actorName: req?.user?.name || '',
      actorRole: req?.user?.employerRole ? `${req.user.role}:${req.user.employerRole}` : (req?.user?.role || ''),
      companyId: resolveCompanyId(req?.user),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ? String(entry.entityId) : '',
      jobId: entry.jobId,
      applicationId: entry.applicationId ? String(entry.applicationId) : '',
      targetUser: entry.targetUser,
      metadata: entry.metadata || {},
      ipAddress: req?.ip || '',
      userAgent: req?.headers?.['user-agent'] || ''
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
};

module.exports = {
  createAuditLog
};
