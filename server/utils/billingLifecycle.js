const PricingPlan = require('../models/pricingPlanModel');
const Subscription = require('../models/subscriptionModel');
const User = require('../models/userModel');
const Notification = require('../models/notificationModel');
const { getDefaultPlanForRole } = require('../config/defaultPlans');

const getGracePeriodDays = () => Math.max(Number(process.env.SUBSCRIPTION_GRACE_DAYS || 7), 1);

const getIntervalDurationMs = (interval) => {
  if (interval === 'yearly') return 365 * 24 * 60 * 60 * 1000;
  if (interval === 'monthly') return 30 * 24 * 60 * 60 * 1000;
  return 0;
};

const calculateBillingPeriod = (interval, anchorDate = new Date()) => {
  const start = new Date(anchorDate);
  const durationMs = getIntervalDurationMs(interval);
  const end = durationMs ? new Date(start.getTime() + durationMs) : null;
  return {
    start,
    end
  };
};

const summarizeSubscriptionLifecycle = (subscription) => {
  if (!subscription) return { state: 'none', label: 'No active subscription' };
  if (subscription.status === 'past_due' && subscription.gracePeriodEndsAt) {
    return {
      state: 'grace_period',
      label: `Grace period until ${new Date(subscription.gracePeriodEndsAt).toLocaleDateString()}`
    };
  }
  if (subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    return {
      state: 'cancels_at_period_end',
      label: `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
    };
  }
  if (subscription.currentPeriodEnd) {
    return {
      state: subscription.status,
      label: `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
    };
  }
  return {
    state: subscription.status,
    label: subscription.status
  };
};

const resolveFreePlan = async (role) => {
  return PricingPlan.findOne({ role, price: 0, isActive: true })
    || getDefaultPlanForRole(role);
};

const activateFallbackFreePlan = async ({ userId, role }) => {
  const freePlan = await resolveFreePlan(role);
  if (!freePlan?._id) return null;

  const subscription = await Subscription.create({
    user: userId,
    plan: freePlan._id,
    role,
    status: 'active',
    startedAt: new Date(),
    currentPeriodStart: new Date(),
    currentPeriodEnd: null,
    expiresAt: null
  });

  await User.findByIdAndUpdate(userId, { currentSubscription: subscription._id });
  return subscription;
};

const markSubscriptionPastDue = async ({ subscription, payment, reason }) => {
  if (!subscription || subscription.status === 'past_due') return subscription;

  subscription.status = 'past_due';
  subscription.renewalFailedAt = new Date();
  subscription.gracePeriodEndsAt = new Date(Date.now() + getGracePeriodDays() * 24 * 60 * 60 * 1000);
  await subscription.save();

  if (payment) {
    payment.status = 'failed';
    payment.failureReason = reason || payment.failureReason || 'Renewal payment failed';
    payment.nextRetryAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await payment.save();
  }

  await Notification.create({
    user: subscription.user,
    type: 'billing',
    message: `Subscription payment failed. Your account is in a grace period until ${subscription.gracePeriodEndsAt.toLocaleDateString()}.`
  });

  return subscription;
};

const expirePastDueSubscriptions = async () => {
  const expiringSubscriptions = await Subscription.find({
    status: 'past_due',
    gracePeriodEndsAt: { $lte: new Date() }
  });

  for (const subscription of expiringSubscriptions) {
    subscription.status = 'expired';
    subscription.autoDowngradedAt = new Date();
    subscription.cancelledAt = new Date();
    await subscription.save();

    await activateFallbackFreePlan({
      userId: subscription.user,
      role: subscription.role
    });

    await Notification.create({
      user: subscription.user,
      type: 'billing',
      message: 'Your paid subscription has expired after the grace period and was downgraded.'
    });
  }
};

const settleExpiredActiveSubscriptions = async () => {
  const subscriptions = await Subscription.find({
    status: 'active',
    expiresAt: { $ne: null, $lte: new Date() }
  });

  for (const subscription of subscriptions) {
    if (subscription.cancelAtPeriodEnd) {
      subscription.status = 'expired';
      subscription.cancelledAt = new Date();
      await subscription.save();
      await activateFallbackFreePlan({
        userId: subscription.user,
        role: subscription.role
      });
      await Notification.create({
        user: subscription.user,
        type: 'billing',
        message: 'Your subscription reached the end of its billing period and has been downgraded.'
      });
      continue;
    }

    await markSubscriptionPastDue({
      subscription,
      reason: 'Renewal payment was not completed before the billing period ended'
    });
  }
};

const runBillingLifecycle = async () => {
  await settleExpiredActiveSubscriptions();
  await expirePastDueSubscriptions();
};

const buildInvoiceHtml = ({ payment, subscription }) => {
  const amount = Number(payment.amount || 0) / 100;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${payment.invoiceNumber || payment.reference}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; color: #1f2937; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; }
      .card { border:1px solid #d1d5db; border-radius:12px; padding:20px; margin-bottom:20px; }
      .muted { color:#6b7280; font-size:12px; }
      .amount { font-size:28px; font-weight:700; }
      table { width:100%; border-collapse:collapse; margin-top:16px; }
      td, th { border-bottom:1px solid #e5e7eb; padding:10px 0; text-align:left; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>JobsParlour Invoice</h1>
        <div class="muted">${payment.invoiceNumber || payment.reference}</div>
      </div>
      <div>
        <div class="muted">Status</div>
        <div>${payment.status}</div>
      </div>
    </div>
    <div class="card">
      <div class="muted">Amount</div>
      <div class="amount">${payment.currency} ${amount.toLocaleString()}</div>
      <table>
        <tr><th>Purpose</th><td>${payment.purpose}</td></tr>
        <tr><th>Created</th><td>${new Date(payment.createdAt).toLocaleString()}</td></tr>
        <tr><th>Paid</th><td>${payment.paidAt ? new Date(payment.paidAt).toLocaleString() : 'Pending'}</td></tr>
        <tr><th>Billing Period</th><td>${payment.billingPeriodStart ? new Date(payment.billingPeriodStart).toLocaleDateString() : 'N/A'} - ${payment.billingPeriodEnd ? new Date(payment.billingPeriodEnd).toLocaleDateString() : 'N/A'}</td></tr>
        <tr><th>Plan</th><td>${subscription?.plan?.name || payment.plan?.name || 'N/A'}</td></tr>
        <tr><th>Reference</th><td>${payment.reference}</td></tr>
      </table>
    </div>
  </body>
</html>`;
};

module.exports = {
  getGracePeriodDays,
  getIntervalDurationMs,
  calculateBillingPeriod,
  summarizeSubscriptionLifecycle,
  activateFallbackFreePlan,
  markSubscriptionPastDue,
  settleExpiredActiveSubscriptions,
  expirePastDueSubscriptions,
  runBillingLifecycle,
  buildInvoiceHtml
};
