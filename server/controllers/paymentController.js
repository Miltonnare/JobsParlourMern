const crypto = require('crypto');
const Job = require('../models/jobModel');
const Payment = require('../models/paymentModel');
const Notification = require('../models/notificationModel');
const PricingPlan = require('../models/pricingPlanModel');
const Subscription = require('../models/subscriptionModel');
const User = require('../models/userModel');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const getPaystackSecret = () => process.env.PAYSTACK_SECRET_KEY;

const generateReference = (userId) => {
  const random = crypto.randomBytes(6).toString('hex');
  return `jobsparlour-${userId}-${Date.now()}-${random}`;
};

const toSubunitAmount = ({ amount, amountSubunit }) => {
  if (amountSubunit !== undefined) return Number(amountSubunit);
  return Math.round(Number(amount) * 100);
};

const callPaystack = async (path, options = {}) => {
  const secretKey = getPaystackSecret();
  if (!secretKey) {
    const error = new Error('PAYSTACK_SECRET_KEY is not configured');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const payload = await response.json();
  if (!response.ok || !payload.status) {
    const error = new Error(payload.message || 'Paystack request failed');
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const applySuccessfulPayment = async (payment, paystackData = {}) => {
  payment.status = 'success';
  payment.paystackId = paystackData.id ? String(paystackData.id) : payment.paystackId;
  payment.paidAt = paystackData.paid_at ? new Date(paystackData.paid_at) : payment.paidAt || new Date();
  payment.channel = paystackData.channel || payment.channel;
  payment.gatewayResponse = paystackData.gateway_response || payment.gatewayResponse;
  payment.rawResponse = paystackData;
  await payment.save();

  if (payment.job) {
    const updates = {
      paymentStatus: 'paid',
      paidAt: payment.paidAt
    };

    if (payment.purpose === 'featured_job') {
      updates.isFeatured = true;
    }

    await Job.findByIdAndUpdate(payment.job, updates);
  }

  if (payment.purpose === 'subscription' && payment.plan) {
    const plan = await PricingPlan.findById(payment.plan);
    if (plan) {
      const expiresAt = plan.interval === 'yearly'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : plan.interval === 'monthly'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : undefined;

      await Subscription.updateMany({ user: payment.user, status: 'active' }, { status: 'cancelled' });
      const subscription = await Subscription.create({
        user: payment.user,
        plan: plan._id,
        payment: payment._id,
        role: plan.role,
        status: 'active',
        expiresAt
      });

      await User.findByIdAndUpdate(payment.user, { currentSubscription: subscription._id });
    }
  }

  await Notification.create({
    user: payment.user,
    type: 'system',
    message: `Payment ${payment.reference} was successful`
  });

  return payment;
};

const getPaystackConfig = async (req, res) => {
  res.json({
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    currency: process.env.PAYSTACK_CURRENCY || 'USD'
  });
};

const initializePayment = async (req, res) => {
  try {
    const {
      amount = process.env.JOB_POSTING_PRICE || 1000,
      amountSubunit,
      currency = process.env.PAYSTACK_CURRENCY || 'USD',
      purpose = 'job_posting',
      jobId,
      planId,
      callbackUrl
    } = req.body;

    const allowedPurposes = ['job_posting', 'featured_job', 'subscription'];
    if (!allowedPurposes.includes(purpose)) {
      return res.status(400).json({ message: 'Invalid payment purpose' });
    }

    if (purpose === 'subscription' && !planId) {
      return res.status(400).json({ message: 'A planId is required for subscription payments' });
    }

    let job = null;
    if (jobId) {
      job = await Job.findById(jobId);
      if (!job) return res.status(404).json({ message: 'Job not found' });
      if (job.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to pay for this job' });
      }
    }

    let plan = null;
    let finalAmount = amount;
    let finalCurrency = currency;
    if (planId) {
      plan = await PricingPlan.findById(planId);
      if (!plan) return res.status(404).json({ message: 'Pricing plan not found' });
      if (plan.role !== req.user.role) {
        return res.status(403).json({ message: 'This plan is not available for your role' });
      }
      if (!plan.isActive) return res.status(400).json({ message: 'This plan is not active' });
      if (plan.price <= 0) return res.status(400).json({ message: 'Use the free-plan endpoint for free plans' });
      finalAmount = plan.price;
      finalCurrency = plan.currency;
    }

    const subunitAmount = toSubunitAmount({ amount: finalAmount, amountSubunit: plan ? undefined : amountSubunit });
    if (!Number.isFinite(subunitAmount) || subunitAmount < 100) {
      return res.status(400).json({ message: 'A valid amount is required' });
    }

    const reference = generateReference(req.user._id);
    const finalCallbackUrl = callbackUrl || process.env.PAYSTACK_CALLBACK_URL || process.env.CLIENT_URL;

    const paystackPayload = await callPaystack('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: req.user.email,
        amount: String(subunitAmount),
        currency: finalCurrency,
        reference,
        callback_url: finalCallbackUrl,
        metadata: {
          userId: req.user._id.toString(),
          jobId: jobId || '',
          planId: planId || '',
          purpose
        }
      })
    });

    const payment = await Payment.create({
      user: req.user._id,
      job: jobId,
      plan: planId,
      purpose,
      amount: subunitAmount,
      currency: finalCurrency,
      reference,
      authorizationUrl: paystackPayload.data.authorization_url,
      accessCode: paystackPayload.data.access_code,
      metadata: {
        userId: req.user._id.toString(),
        jobId: jobId || '',
        planId: planId || '',
        purpose
      },
      rawResponse: paystackPayload.data
    });

    if (job && job.paymentStatus === 'not_required') {
      job.paymentStatus = 'unpaid';
      await job.save();
    }

    res.status(201).json({
      message: 'Payment initialized',
      payment,
      authorizationUrl: paystackPayload.data.authorization_url,
      accessCode: paystackPayload.data.access_code,
      reference
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Could not initialize payment',
      details: error.payload
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const payment = await Payment.findOne({ reference });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const payload = await callPaystack(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET'
    });

    if (payload.data.status === 'success') {
      await applySuccessfulPayment(payment, payload.data);
    } else {
      payment.status = payload.data.status || 'failed';
      payment.gatewayResponse = payload.data.gateway_response;
      payment.rawResponse = payload.data;
      await payment.save();
    }

    res.json({ message: 'Payment verified', payment });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Could not verify payment',
      details: error.payload
    });
  }
};

const getMyPayments = async (req, res) => {
  const payments = await Payment.find({ user: req.user._id })
    .populate('job', 'title location status paymentStatus isFeatured')
    .populate('plan', 'name slug role price currency interval features limits')
    .sort({ createdAt: -1 });

  res.json(payments);
};

const handlePaystackWebhook = async (req, res) => {
  const secretKey = getPaystackSecret();
  if (!secretKey) return res.status(500).json({ message: 'PAYSTACK_SECRET_KEY is not configured' });

  const signature = req.headers['x-paystack-signature'];
  const body = req.rawBody || JSON.stringify(req.body);
  const hash = crypto.createHmac('sha512', secretKey).update(body).digest('hex');

  if (hash !== signature) {
    return res.status(401).json({ message: 'Invalid Paystack signature' });
  }

  const event = req.body;
  if (event.event === 'charge.success') {
    const reference = event.data?.reference;
    const payment = await Payment.findOne({ reference });
    if (payment && payment.status !== 'success') {
      await applySuccessfulPayment(payment, event.data);
    }
  }

  res.sendStatus(200);
};

module.exports = {
  getPaystackConfig,
  initializePayment,
  verifyPayment,
  getMyPayments,
  handlePaystackWebhook
};
