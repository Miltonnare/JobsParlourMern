const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const JobAlert = require('../models/jobAlertModel');
const { parseResumeText, syncProfileInsights } = require('../utils/profileInsights');

test('parseResumeText extracts summary, contact details, and skill hints', () => {
  const parsed = parseResumeText(`
    Grace Hopper
    grace@example.com
    https://github.com/grace
    Senior React and Node engineer with AWS experience.
  `);

  assert.equal(parsed.emails[0], 'grace@example.com');
  assert.ok(parsed.links.some((link) => link.includes('github.com/grace')));
  assert.ok(parsed.skills.includes('react'));
  assert.ok(parsed.skills.includes('node'));
  assert.ok(parsed.summary.includes('Grace Hopper'));
});

test('syncProfileInsights stores parsed resume data and completeness score on users', () => {
  const user = new User({
    name: 'Grace',
    email: 'grace@example.com',
    password: 'hashed-password',
    role: 'jobseeker',
    bio: 'Frontend engineer',
    education: 'BSc Computer Science',
    experience: '5 years',
    resumeUrl: 'https://example.com/resume.pdf',
    resumeText: 'React Node MongoDB engineer with leadership experience.'
  });

  const completeness = syncProfileInsights(user, 'test');

  assert.ok(user.parsedResume.skills.includes('react'));
  assert.ok(user.parsedResume.skills.includes('mongodb'));
  assert.equal(user.parsedResume.source, 'test');
  assert.equal(user.profileCompletenessScore, completeness.score);
  assert.ok(user.profileCompletenessScore > 50);
});

test('job alerts support saved-search metadata for alerts and previews', () => {
  const alert = new JobAlert({
    userId: new mongoose.Types.ObjectId(),
    name: 'Remote React roles',
    keywords: ['React'],
    locations: ['Remote'],
    alertEnabled: true,
    lastMatchedCount: 3
  });

  assert.equal(alert.name, 'Remote React roles');
  assert.equal(alert.alertEnabled, true);
  assert.equal(alert.lastMatchedCount, 3);
  assert.equal(alert.validateSync(), undefined);
});
