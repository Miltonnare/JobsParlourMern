const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Job = require('../models/jobModel');
const Report = require('../models/reportModel');

test('user model stores employer verification and trust flags', () => {
  const employer = new User({
    name: 'Acme Owner',
    email: 'owner@example.com',
    password: 'hashed-password',
    role: 'employer',
    employerVerification: {
      status: 'pending',
      notes: 'Awaiting manual review'
    },
    trustFlags: {
      reportCount: 2,
      suspiciousJobCount: 1
    }
  });

  assert.equal(employer.employerVerification.status, 'pending');
  assert.equal(employer.trustFlags.reportCount, 2);
  assert.equal(employer.validateSync(), undefined);
});

test('job model stores moderation review state', () => {
  const reviewerId = new mongoose.Types.ObjectId();
  const job = new Job({
    title: 'Remote Operations Lead',
    description: 'Urgent hire. Send a registration fee before training.',
    location: 'Remote',
    createdBy: new mongoose.Types.ObjectId(),
    moderation: {
      isFlagged: true,
      suspiciousScore: 6,
      reasons: ['Mentions candidate fee or upfront payment'],
      reviewStatus: 'reviewing',
      reviewedBy: reviewerId
    }
  });

  assert.equal(job.moderation.isFlagged, true);
  assert.equal(job.moderation.suspiciousScore, 6);
  assert.equal(String(job.moderation.reviewedBy), String(reviewerId));
  assert.equal(job.validateSync(), undefined);
});

test('report model stores moderation category and admin notes', () => {
  const report = new Report({
    job: new mongoose.Types.ObjectId(),
    reportedBy: new mongoose.Types.ObjectId(),
    reason: 'This looks like a scam',
    category: 'scam',
    priority: 'high',
    adminNotes: 'Escalated for manual review'
  });

  assert.equal(report.category, 'scam');
  assert.equal(report.priority, 'high');
  assert.equal(report.validateSync(), undefined);
});
