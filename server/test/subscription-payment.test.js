const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Payment = require('../models/paymentModel');
const Subscription = require('../models/subscriptionModel');

test('subscription and payment models link users to purchased pricing plans', () => {
  const userId = new mongoose.Types.ObjectId();
  const planId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();

  const payment = new Payment({
    _id: paymentId,
    user: userId,
    plan: planId,
    purpose: 'subscription',
    amount: 30000,
    currency: 'USD',
    reference: 'jobsparlour-test-reference',
    status: 'success'
  });

  const subscription = new Subscription({
    user: userId,
    plan: planId,
    payment: paymentId,
    role: 'employer',
    status: 'active'
  });

  assert.equal(payment.purpose, 'subscription');
  assert.equal(String(payment.plan), String(planId));
  assert.equal(subscription.status, 'active');
  assert.equal(subscription.validateSync(), undefined);
  assert.equal(payment.validateSync(), undefined);
});
