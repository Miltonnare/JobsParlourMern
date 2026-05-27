const { getBillingOwnerId } = require('./subscriptionMiddleware');

const EMPLOYER_CAPABILITIES = {
  owner: new Set([
    'billing.manage',
    'team.manage',
    'jobs.create',
    'jobs.update',
    'jobs.delete',
    'jobs.feature',
    'jobs.exportApplicants',
    'applications.review',
    'applications.advance',
    'applications.notes',
    'applications.interviews',
    'analytics.view',
    'messages.send'
  ]),
  recruiter: new Set([
    'jobs.create',
    'jobs.update',
    'applications.review',
    'applications.advance',
    'applications.notes',
    'applications.interviews',
    'analytics.view',
    'messages.send'
  ]),
  hiring_manager: new Set([
    'applications.review',
    'applications.advance',
    'applications.notes',
    'applications.interviews',
    'analytics.view',
    'messages.send'
  ])
};

const getEmployerRole = (currentUser) => {
  if (currentUser.role !== 'employer') return null;
  if (!currentUser.companyId) return 'owner';
  return currentUser.employerRole || 'recruiter';
};

const hasEmployerCapability = (currentUser, capability) => {
  const employerRole = getEmployerRole(currentUser);
  if (!employerRole) return false;
  return EMPLOYER_CAPABILITIES[employerRole]?.has(capability) || false;
};

const requireEmployerCapability = (capability) => (req, res, next) => {
  if (req.user?.role !== 'employer') {
    return res.status(403).json({ message: 'Employer access required', requestId: req.requestId });
  }

  if (!hasEmployerCapability(req.user, capability)) {
    return res.status(403).json({
      message: `Your employer role does not allow ${capability}`,
      requestId: req.requestId
    });
  }

  req.employerScope = {
    role: getEmployerRole(req.user),
    ownerId: getBillingOwnerId(req.user)
  };
  next();
};

const requireBillingAccess = (req, res, next) => {
  if (req.user?.role === 'employer') {
    return requireEmployerCapability('billing.manage')(req, res, next);
  }

  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required', requestId: req.requestId });
  }

  next();
};

module.exports = {
  EMPLOYER_CAPABILITIES,
  getEmployerRole,
  hasEmployerCapability,
  requireEmployerCapability,
  requireBillingAccess
};
