const PricingPlan = require('../models/pricingPlanModel');
const Subscription = require('../models/subscriptionModel');
const { DEFAULT_PLANS } = require('../config/defaultPlans');
const { summarizeSubscriptionLifecycle } = require('../utils/billingLifecycle');
const { createAuditLog } = require('../utils/auditLogger');

const getBillingUserId = (currentUser) => currentUser.role === 'employer' && currentUser.companyId
  ? currentUser.companyId
  : currentUser._id;

const getPricingPlans = async (req, res) => {
  const query = { isActive: true };
  if (req.query.role) query.role = req.query.role;

  const plans = await PricingPlan.find(query).sort({ role: 1, sortOrder: 1, price: 1 });
  res.json(plans.length > 0 ? plans : DEFAULT_PLANS.filter(plan => !req.query.role || plan.role === req.query.role));
};

const seedPricingPlans = async (req, res) => {
  const savedPlans = [];

  for (const plan of DEFAULT_PLANS) {
    const saved = await PricingPlan.findOneAndUpdate(
      { slug: plan.slug },
      plan,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    savedPlans.push(saved);
  }

  res.status(201).json({ message: 'Pricing plans seeded', plans: savedPlans });
};

const createPricingPlan = async (req, res) => {
  const plan = await PricingPlan.create(req.body);
  await createAuditLog(req, {
    action: 'pricing.plan_created',
    entityType: 'pricing_plan',
    entityId: plan._id,
    metadata: {
      slug: plan.slug,
      role: plan.role,
      price: plan.price,
      interval: plan.interval
    }
  });
  res.status(201).json(plan);
};

const updatePricingPlan = async (req, res) => {
  const plan = await PricingPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!plan) return res.status(404).json({ message: 'Pricing plan not found' });
  await createAuditLog(req, {
    action: 'pricing.plan_updated',
    entityType: 'pricing_plan',
    entityId: plan._id,
    metadata: {
      slug: plan.slug,
      updatedFields: Object.keys(req.body || {})
    }
  });
  res.json(plan);
};

const getMySubscription = async (req, res) => {
  const subscription = await Subscription.findOne({
    user: getBillingUserId(req.user),
    status: { $in: ['active', 'trialing', 'past_due', 'cancelled', 'expired'] },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  }).populate('plan payment');

  res.json({
    subscription,
    lifecycle: summarizeSubscriptionLifecycle(subscription)
  });
};

const activateFreePlan = async (req, res) => {
  const plan = await PricingPlan.findById(req.params.planId);
  if (!plan) return res.status(404).json({ message: 'Pricing plan not found' });
  if (plan.role !== req.user.role) return res.status(403).json({ message: 'This plan is not available for your role' });
  if (plan.price > 0) return res.status(400).json({ message: 'Paid plans must be purchased through payments' });

  const billingUserId = getBillingUserId(req.user);
  await Subscription.updateMany({ user: billingUserId, status: 'active' }, { status: 'cancelled', cancelledAt: new Date() });
  const subscription = await Subscription.create({
    user: billingUserId,
    plan: plan._id,
    role: req.user.role,
    status: 'active'
  });

  req.user.currentSubscription = subscription._id;
  await req.user.save();
  await createAuditLog(req, {
    action: 'billing.free_plan_activated',
    entityType: 'subscription',
    entityId: subscription._id,
    metadata: {
      planId: plan._id,
      planSlug: plan.slug
    }
  });

  res.status(201).json({ message: 'Free plan activated', subscription });
};

const changeSubscriptionPlan = async (req, res) => {
  const { planId } = req.body;
  if (!planId) return res.status(400).json({ message: 'planId is required' });

  const targetPlan = await PricingPlan.findById(planId);
  if (!targetPlan) return res.status(404).json({ message: 'Pricing plan not found' });
  if (targetPlan.role !== req.user.role) return res.status(403).json({ message: 'This plan is not available for your role' });

  const billingUserId = getBillingUserId(req.user);
  const currentSubscription = await Subscription.findOne({
    user: billingUserId,
    status: { $in: ['active', 'trialing', 'past_due'] }
  }).populate('plan');

  if (currentSubscription?.plan?._id?.toString() === targetPlan._id.toString()) {
    return res.status(400).json({ message: 'You are already on this plan' });
  }

  if (targetPlan.price <= 0) {
    await Subscription.updateMany({ user: billingUserId, status: { $in: ['active', 'trialing', 'past_due'] } }, {
      status: 'cancelled',
      cancelledAt: new Date()
    });

    const subscription = await Subscription.create({
      user: billingUserId,
      plan: targetPlan._id,
      role: req.user.role,
      status: 'active'
    });
    await createAuditLog(req, {
      action: 'billing.plan_changed',
      entityType: 'subscription',
      entityId: subscription._id,
      metadata: {
        planId: targetPlan._id,
        planSlug: targetPlan.slug,
        requiresPayment: false
      }
    });

    return res.json({
      message: 'Plan changed successfully',
      requiresPayment: false,
      subscription
    });
  }

  if (currentSubscription) {
    currentSubscription.pendingPlan = targetPlan._id;
    await currentSubscription.save();
  }
  await createAuditLog(req, {
    action: 'billing.plan_change_requested',
    entityType: 'subscription',
    entityId: currentSubscription?._id,
    metadata: {
      currentPlanId: currentSubscription?.plan?._id || '',
      targetPlanId: targetPlan._id,
      targetPlanSlug: targetPlan.slug,
      requiresPayment: true
    }
  });

  res.json({
    message: 'Plan change requested. Initialize a subscription payment to complete the upgrade or downgrade.',
    requiresPayment: true,
    nextStep: 'POST /api/payments/initialize with purpose=subscription and the target planId',
    plan: targetPlan
  });
};

const cancelSubscription = async (req, res) => {
  const billingUserId = getBillingUserId(req.user);
  const subscription = await Subscription.findOne({
    user: billingUserId,
    status: { $in: ['active', 'trialing', 'past_due'] }
  }).populate('plan');

  if (!subscription) return res.status(404).json({ message: 'No active subscription found' });

  subscription.cancelAtPeriodEnd = true;
  await subscription.save();
  await createAuditLog(req, {
    action: 'billing.subscription_cancelled',
    entityType: 'subscription',
    entityId: subscription._id,
    metadata: {
      planId: subscription.plan?._id || '',
      cancelAtPeriodEnd: true
    }
  });

  res.json({
    message: 'Subscription will cancel at the end of the current billing period',
    subscription
  });
};

module.exports = {
  getPricingPlans,
  seedPricingPlans,
  createPricingPlan,
  updatePricingPlan,
  getMySubscription,
  activateFreePlan,
  changeSubscriptionPlan,
  cancelSubscription
};
