const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const { ensureSinglePrimaryResume, syncPrimaryResumeFields } = require('../utils/resumeLibrary');

test('user model stores multiple resumes for a jobseeker profile', () => {
  const primaryResumeId = new mongoose.Types.ObjectId();
  const secondaryResumeId = new mongoose.Types.ObjectId();

  const user = new User({
    name: 'Grace',
    email: 'grace@example.com',
    password: 'hashed-password',
    role: 'jobseeker',
    resumes: [
      {
        _id: primaryResumeId,
        label: 'Software Resume',
        resumeUrl: 'https://example.com/software.pdf',
        resumeText: 'React Node engineer',
        isPrimary: true
      },
      {
        _id: secondaryResumeId,
        label: 'Product Resume',
        resumeUrl: 'https://example.com/product.pdf',
        resumeText: 'Product strategy experience',
        isPrimary: false
      }
    ]
  });

  assert.equal(user.resumes.length, 2);
  assert.equal(user.resumes[0].isPrimary, true);
  assert.equal(user.resumes[1].label, 'Product Resume');
  assert.equal(user.validateSync(), undefined);
});

test('ensureSinglePrimaryResume promotes one stored resume and syncs top-level profile fields', () => {
  const firstResumeId = new mongoose.Types.ObjectId();
  const secondResumeId = new mongoose.Types.ObjectId();

  const user = new User({
    name: 'Grace',
    email: 'grace@example.com',
    password: 'hashed-password',
    role: 'jobseeker',
    resumes: [
      {
        _id: firstResumeId,
        label: 'Software Resume',
        resumeUrl: 'https://example.com/software.pdf',
        resumeText: 'React Node engineer',
        parsedResume: { summary: 'Software profile' }
      },
      {
        _id: secondResumeId,
        label: 'Data Resume',
        resumeUrl: 'https://example.com/data.pdf',
        resumeText: 'Data pipelines and analytics',
        parsedResume: { summary: 'Data profile' }
      }
    ]
  });

  const primaryResume = ensureSinglePrimaryResume(user, secondResumeId);

  assert.equal(String(primaryResume._id), String(secondResumeId));
  assert.equal(user.resumes[0].isPrimary, false);
  assert.equal(user.resumes[1].isPrimary, true);
  assert.equal(user.resumeUrl, 'https://example.com/data.pdf');
  assert.equal(user.resumeText, 'Data pipelines and analytics');
});

test('syncPrimaryResumeFields clears top-level resume data when there is no primary resume', () => {
  const user = new User({
    name: 'Ada',
    email: 'ada@example.com',
    password: 'hashed-password',
    role: 'jobseeker',
    resumeUrl: 'https://example.com/old.pdf',
    resumeText: 'Old resume text'
  });

  syncPrimaryResumeFields(user, null);

  assert.equal(user.resumeUrl, '');
  assert.equal(user.resumeText, '');
  assert.equal(user.resumeParsing.status, 'idle');
});
