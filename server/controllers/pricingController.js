const PricingPlan = require('../models/pricingPlanModel');
const Subscription = require('../models/subscriptionModel');

const DEFAULT_PLANS = [
  {
    name: 'Job Seeker Free',
    slug: 'jobseeker-free',
    role: 'jobseeker',
    description: 'Basic job discovery and applications.',
    price: 0,
    currency: 'USD',
    interval: 'free',
    sortOrder: 1,
    features: ['Browse jobs', 'Save jobs', 'Apply with profile', 'Basic ATS match'],
    limits: { applicationsPerMonth: 10, savedJobs: 25 }
  },
  {
    name: 'Job Seeker Pro',
    slug: 'jobseeker-pro',
    role: 'jobseeker',
    description: 'More applications, bidding, and stronger candidate insights.',
    price: 500,
    currency: 'USD',
    interval: 'monthly',
    sortOrder: 2,
    features: ['Unlimited applications', 'Application bidding', 'Advanced ATS insights', 'Profile boost'],
    limits: { applicationsPerMonth: -1, savedJobs: -1, profileBoosts: 3 }
  },
  {
    name: 'Employer Starter',
    slug: 'employer-starter',
    role: 'employer',
    description: 'Post jobs and manage applicants.',
    price: 1000,
    currency: 'USD',
    interval: 'monthly',
    sortOrder: 1,
    features: ['Post up to 3 jobs', 'Applicant pipeline', 'CSV export', 'Basic ATS sorting'],
    limits: { activeJobs: 3, applicantExports: 5 }
  },
  {
    name: 'Employer Growth',
    slug: 'employer-growth',
    role: 'employer',
    description: 'Scale hiring with featured jobs and richer applicant tools.',
    price: 3000,
    currency: 'USD',
    interval: 'monthly',
    sortOrder: 2,
    features: ['Unlimited jobs', 'Featured jobs', 'Advanced ATS ranking', 'Priority applicant pipeline'],
    limits: { activeJobs: -1, featuredJobs: 5, applicantExports: -1 }
  }
];

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
  res.status(201).json(plan);
};

const updatePricingPlan = async (req, res) => {
  const plan = await PricingPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!plan) return res.status(404).json({ message: 'Pricing plan not found' });
  res.json(plan);
};

const getMySubscription = async (req, res) => {
  const subscription = await Subscription.findOne({
    user: req.user._id,
    status: 'active',
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  }).populate('plan payment');

  res.json({ subscription });
};

const activateFreePlan = async (req, res) => {
  const plan = await PricingPlan.findById(req.params.planId);
  if (!plan) return res.status(404).json({ message: 'Pricing plan not found' });
  if (plan.role !== req.user.role) return res.status(403).json({ message: 'This plan is not available for your role' });
  if (plan.price > 0) return res.status(400).json({ message: 'Paid plans must be purchased through payments' });

  await Subscription.updateMany({ user: req.user._id, status: 'active' }, { status: 'cancelled' });
  const subscription = await Subscription.create({
    user: req.user._id,
    plan: plan._id,
    role: req.user.role,
    status: 'active'
  });

  req.user.currentSubscription = subscription._id;
  await req.user.save();

  res.status(201).json({ message: 'Free plan activated', subscription });
};

module.exports = {
  getPricingPlans,
  seedPricingPlans,
  createPricingPlan,
  updatePricingPlan,
  getMySubscription,
  activateFreePlan
};
