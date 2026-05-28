const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Payment = require('../models/paymentModel');
const Subscription = require('../models/subscriptionModel');
const {
  calculateBillingPeriod,
  summarizeSubscriptionLifecycle
} = require('../utils/billingLifecycle');

test('calculateBillingPeriod derives monthly and yearly billing windows', () => {
  const anchor = new Date('2026-01-15T00:00:00.000Z');
  const monthly = calculateBillingPeriod('monthly', anchor);
  const yearly = calculateBillingPeriod('yearly', anchor);

  assert.equal(monthly.start.toISOString(), anchor.toISOString());
  assert.equal(monthly.end.toISOString(), new Date('2026-02-14T00:00:00.000Z').toISOString());
  assert.equal(yearly.end.toISOString(), new Date('2027-01-15T00:00:00.000Z').toISOString());
});

test('summarizeSubscriptionLifecycle highlights grace periods and scheduled cancellation', () => {
  const graceSubscription = new Subscription({
    user: new mongoose.Types.ObjectId(),
    plan: new mongoose.Types.ObjectId(),
    role: 'employer',
    status: 'past_due',
    gracePeriodEndsAt: new Date('2026-06-01T00:00:00.000Z')
  });
  const cancellingSubscription = new Subscription({
    user: new mongoose.Types.ObjectId(),
    plan: new mongoose.Types.ObjectId(),
    role: 'jobseeker',
    status: 'active',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: new Date('2026-06-15T00:00:00.000Z')
  });

  assert.equal(summarizeSubscriptionLifecycle(graceSubscription).state, 'grace_period');
  assert.equal(summarizeSubscriptionLifecycle(cancellingSubscription).state, 'cancels_at_period_end');
});

test('payment and subscription models support billing lifecycle fields', () => {
  const payment = new Payment({
    user: new mongoose.Types.ObjectId(),
    purpose: 'subscription',
    amount: 3000,
    currency: 'USD',
    reference: 'jobsparlour-billing-lifecycle',
    invoiceNumber: 'INV-LIFECYCLE-001',
    webhookEvents: ['123'],
    billingPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
    billingPeriodEnd: new Date('2026-05-31T00:00:00.000Z')
  });
  const subscription = new Subscription({
    user: new mongoose.Types.ObjectId(),
    plan: new mongoose.Types.ObjectId(),
    role: 'employer',
    status: 'past_due',
    currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-05-31T00:00:00.000Z'),
    gracePeriodEndsAt: new Date('2026-06-07T00:00:00.000Z')
  });

  assert.deepEqual(payment.webhookEvents, ['123']);
  assert.ok(payment.billingPeriodEnd instanceof Date);
  assert.ok(subscription.gracePeriodEndsAt instanceof Date);
  assert.equal(payment.validateSync(), undefined);
  assert.equal(subscription.validateSync(), undefined);
});
