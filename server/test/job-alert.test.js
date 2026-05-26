const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const JobAlert = require('../models/jobAlertModel');
const Job = require('../models/jobModel');
const { createJobAlert } = require('../controllers/jobAlertController');
const { runJobAlerts } = require('../utils/jobAlertScheduler');

test('JobAlert model validates correct preferences and defaults', () => {
  const userId = new mongoose.Types.ObjectId();
  const alert = new JobAlert({
    userId,
    keywords: ['Node', 'Express'],
    categories: ['Backend'],
    locations: ['Remote', 'Nairobi'],
    frequency: 'daily'
  });

  assert.equal(String(alert.userId), String(userId));
  assert.deepEqual(alert.keywords, ['Node', 'Express']);
  assert.deepEqual(alert.categories, ['Backend']);
  assert.deepEqual(alert.locations, ['Remote', 'Nairobi']);
  assert.equal(alert.frequency, 'daily');
  assert.equal(alert.isActive, true);
  assert.ok(alert.lastSent instanceof Date);
  assert.deepEqual(alert.sentJobs, []);
  assert.equal(alert.validateSync(), undefined);
});

test('JobAlert model validation fails without required userId', () => {
  const alert = new JobAlert({
    keywords: ['React'],
    frequency: 'weekly'
  });

  const errors = alert.validateSync();
  assert.ok(errors);
  assert.ok(errors.errors.userId);
});

test('JobAlert model validation fails with invalid frequency', () => {
  const userId = new mongoose.Types.ObjectId();
  const alert = new JobAlert({
    userId,
    frequency: 'monthly' // Only 'daily' | 'weekly' are valid
  });

  const errors = alert.validateSync();
  assert.ok(errors);
  assert.ok(errors.errors.frequency);
});

test('createJobAlert controller creates and returns new job alert', async () => {
  const originalCreate = JobAlert.create;
  const mockUser = { _id: new mongoose.Types.ObjectId() };
  let createdPayload = null;

  JobAlert.create = async (payload) => {
    createdPayload = payload;
    return { _id: 'mock-id', ...payload };
  };

  const req = {
    user: mockUser,
    body: {
      keywords: ['Node'],
      frequency: 'daily'
    }
  };

  let responseStatus = null;
  let responseData = null;

  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  try {
    await createJobAlert(req, res);
    assert.equal(responseStatus, 201);
    assert.equal(responseData._id, 'mock-id');
    assert.equal(String(responseData.userId), String(mockUser._id));
    assert.deepEqual(responseData.keywords, ['Node']);
  } finally {
    JobAlert.create = originalCreate;
  }
});

test('runJobAlerts constructs correct mongo query for job matches', async () => {
  const originalAlertFind = JobAlert.find;
  const originalJobFind = Job.find;

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    email: 'test@example.com',
    name: 'Test Jobseeker'
  };

  const mockAlert = {
    userId: mockUser,
    isActive: true,
    frequency: 'daily',
    lastSent: new Date(Date.now() - 3600000), // 1 hour ago
    keywords: ['Node'],
    categories: ['Backend'],
    locations: ['Remote'],
    sentJobs: [],
    save: async () => {}
  };

  // Mock JobAlert.find().populate()
  JobAlert.find = () => {
    return {
      populate: () => [mockAlert]
    };
  };

  let capturedQuery = null;
  // Mock Job.find().populate()
  Job.find = (query) => {
    capturedQuery = query;
    return {
      populate: async () => [] // return empty list to avoid actual email send
    };
  };

  try {
    await runJobAlerts();

    // Verify constructed query matches the expected criteria
    assert.ok(capturedQuery);
    assert.equal(capturedQuery.status, 'active');
    assert.ok(capturedQuery.createdAt.$gt instanceof Date);
    assert.ok(capturedQuery.$and);
    assert.equal(capturedQuery.$and.length, 3); // keywords, categories, locations
  } finally {
    JobAlert.find = originalAlertFind;
    Job.find = originalJobFind;
  }
});
