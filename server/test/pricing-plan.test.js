const test = require('node:test');
const assert = require('node:assert/strict');
const PricingPlan = require('../models/pricingPlanModel');

test('pricing plan model validates role-based paid plans', () => {
  const plan = new PricingPlan({
    name: 'Employer Growth',
    slug: 'employer-growth-test',
    role: 'employer',
    price: 3000,
    currency: 'USD',
    interval: 'monthly',
    features: ['Unlimited jobs', 'Featured jobs'],
    limits: { activeJobs: -1, featuredJobs: 5 }
  });

  assert.equal(plan.role, 'employer');
  assert.equal(plan.price, 3000);
  assert.equal(plan.validateSync(), undefined);
});
