const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/userModel');

test('user model stores onboarding and personalization preferences for jobseekers', () => {
  const user = new User({
    name: 'Grace',
    email: 'grace@example.com',
    password: 'hashed-password',
    role: 'jobseeker',
    onboarding: {
      completed: true,
      currentStep: 'done',
      completedSteps: ['profile', 'preferences'],
      answers: { goal: 'remote work' },
      completedAt: new Date()
    },
    personalization: {
      targetRoles: ['Frontend Developer'],
      preferredLocations: ['Remote'],
      preferredJobTypes: ['contract'],
      salaryMin: 50000,
      salaryMax: 120000,
      openToBids: true
    }
  });

  assert.equal(user.onboarding.completed, true);
  assert.deepEqual(user.personalization.targetRoles, ['Frontend Developer']);
  assert.equal(user.personalization.openToBids, true);
  assert.equal(user.validateSync(), undefined);
});
