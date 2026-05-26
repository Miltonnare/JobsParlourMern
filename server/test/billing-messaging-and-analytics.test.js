const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Payment = require('../models/paymentModel');
const Message = require('../models/messageModel');
const Job = require('../models/jobModel');

test('payment model supports invoices, retries, and profile boosts', () => {
  const payment = new Payment({
    user: new mongoose.Types.ObjectId(),
    purpose: 'profile_boost',
    amount: 1200,
    currency: 'USD',
    reference: 'jobsparlour-ref-boost',
    invoiceNumber: 'INV-TEST-001',
    retryCount: 2,
    failureReason: 'Card declined'
  });

  assert.equal(payment.purpose, 'profile_boost');
  assert.equal(payment.invoiceNumber, 'INV-TEST-001');
  assert.equal(payment.retryCount, 2);
  assert.equal(payment.failureReason, 'Card declined');
  assert.equal(payment.validateSync(), undefined);
});

test('message model stores company-scoped job conversations', () => {
  const companyId = new mongoose.Types.ObjectId();
  const sender = new mongoose.Types.ObjectId();
  const receiver = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();

  const message = new Message({
    sender,
    receiver,
    companyId,
    jobId,
    applicationId: new mongoose.Types.ObjectId(),
    conversationKey: `thread:${jobId}`,
    content: 'Thanks for applying'
  });

  assert.equal(String(message.companyId), String(companyId));
  assert.equal(message.conversationKey, `thread:${jobId}`);
  assert.equal(message.read, false);
  assert.equal(message.validateSync(), undefined);
});

test('job model stores featured analytics and interview scheduling details', () => {
  const job = new Job({
    title: 'Backend Engineer',
    description: 'Build APIs and data pipelines.',
    location: 'Remote',
    createdBy: new mongoose.Types.ObjectId(),
    isFeatured: true,
    featuredAnalytics: {
      impressions: 10,
      clicks: 4
    },
    applications: [{
      user: new mongoose.Types.ObjectId(),
      interviews: [{
        scheduledAt: new Date(),
        interviewer: 'Hiring Manager',
        meetingLink: 'https://meet.example.com/interview',
        location: 'Zoom'
      }]
    }]
  });

  assert.equal(job.featuredAnalytics.impressions, 10);
  assert.equal(job.applications[0].interviews[0].meetingLink, 'https://meet.example.com/interview');
  assert.equal(job.applications[0].interviews[0].location, 'Zoom');
  assert.equal(job.validateSync(), undefined);
});
