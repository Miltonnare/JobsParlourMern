const Job = require('../models/jobModel');
const Subscription = require('../models/subscriptionModel');
const PricingPlan = require('../models/pricingPlanModel');
const JobAlert = require('../models/jobAlertModel');
const { getDefaultPlanForRole } = require('../config/defaultPlans');

const getBillingOwnerId = (currentUser) => currentUser.role === 'employer' && currentUser.companyId
  ? currentUser.companyId
  : currentUser._id;

const getActiveSubscriptionContext = async (currentUser) => {
  const billingUserId = getBillingOwnerId(currentUser);
  const subscription = await Subscription.findOne({
    user: billingUserId,
    role: currentUser.role,
    status: { $in: ['active', 'trialing', 'past_due'] },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  }).populate('plan');

  const plan = subscription?.plan
    || await PricingPlan.findOne({ role: currentUser.role, price: 0, isActive: true })
    || getDefaultPlanForRole(currentUser.role);

  return {
    billingUserId,
    subscription,
    plan,
    limits: plan?.limits || {}
  };
};

const getUsageWindowKey = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const getUsageValue = (subscription, key) => {
  if (!subscription?.usage) return 0;
  const usageKey = `${key}:${getUsageWindowKey()}`;
  return Number(subscription.usage[usageKey] || 0);
};

const bumpUsageValue = async (subscription, key, amount = 1) => {
  if (!subscription) return null;
  const usage = { ...(subscription.usage || {}) };
  const usageKey = `${key}:${getUsageWindowKey()}`;
  usage[usageKey] = Number(usage[usageKey] || 0) + amount;
  subscription.usage = usage;
  await subscription.save();
  return usage[usageKey];
};

const assertWithinLimit = async (currentUser, action) => {
  const context = await getActiveSubscriptionContext(currentUser);
  const { limits, billingUserId, subscription } = context;
  const unlimited = -1;

  if (action === 'post_job') {
    const limit = Number(limits.activeJobs ?? unlimited);
    if (limit !== unlimited) {
      const activeJobs = await Job.countDocuments({ createdBy: billingUserId, status: { $ne: 'closed' } });
      if (activeJobs >= limit) {
        const error = new Error(`Your plan allows ${limit} active job posting${limit === 1 ? '' : 's'}. Upgrade to add more.`);
        error.statusCode = 403;
        throw error;
      }
    }
  }

  if (action === 'apply_job') {
    const limit = Number(limits.applicationsPerMonth ?? unlimited);
    if (limit !== unlimited) {
      const windowStart = new Date();
      windowStart.setUTCDate(1);
      windowStart.setUTCHours(0, 0, 0, 0);

      const counts = await Job.aggregate([
        { $unwind: '$applications' },
        {
          $match: {
            'applications.user': currentUser._id,
            'applications.appliedAt': { $gte: windowStart }
          }
        },
        { $count: 'total' }
      ]);
      const applicationsUsed = counts[0]?.total || 0;
      if (applicationsUsed >= limit) {
        const error = new Error(`Your plan allows ${limit} application${limit === 1 ? '' : 's'} per month. Upgrade to keep applying.`);
        error.statusCode = 403;
        throw error;
      }
    }
  }

  if (action === 'export_applicants') {
    const limit = Number(limits.applicantExports ?? unlimited);
    if (limit !== unlimited) {
      const used = getUsageValue(subscription, 'applicantExports');
      if (used >= limit) {
        const error = new Error(`Your plan allows ${limit} applicant export${limit === 1 ? '' : 's'} per month.`);
        error.statusCode = 403;
        throw error;
      }
    }
  }

  if (action === 'feature_job') {
    const limit = Number(limits.featuredJobs ?? unlimited);
    if (limit !== unlimited) {
      const featuredActive = await Job.countDocuments({
        createdBy: billingUserId,
        isFeatured: true,
        featuredUntil: { $gt: new Date() }
      });
      if (featuredActive >= limit) {
        const error = new Error(`Your plan allows ${limit} featured job${limit === 1 ? '' : 's'} at a time.`);
        error.statusCode = 403;
        throw error;
      }
    }
  }

  if (action === 'boost_profile') {
    const limit = Number(limits.profileBoosts ?? unlimited);
    if (limit !== unlimited) {
      const used = getUsageValue(subscription, 'profileBoosts');
      if (used >= limit) {
        const error = new Error(`Your plan allows ${limit} profile boost${limit === 1 ? '' : 's'} per month.`);
        error.statusCode = 403;
        throw error;
      }
    }
  }

  if (action === 'save_search') {
    const limit = Number(limits.savedSearches ?? unlimited);
    if (limit !== unlimited) {
      const savedSearches = await JobAlert.countDocuments({ userId: currentUser._id });
      if (savedSearches >= limit) {
        const error = new Error(`Your plan allows ${limit} saved search${limit === 1 ? '' : 'es'}.`);
        error.statusCode = 403;
        throw error;
      }
    }
  }

  context.usage = subscription?.usage || {};
  return context;
};

const enforcePlanLimit = (action) => async (req, res, next) => {
  try {
    req.subscriptionContext = await assertWithinLimit(req.user, action);
    next();
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Plan limit check failed' });
  }
};

module.exports = {
  getBillingOwnerId,
  getActiveSubscriptionContext,
  enforcePlanLimit,
  bumpUsageValue,
  getUsageValue
};
