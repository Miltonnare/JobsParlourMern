const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/userModel');

test('user model stores email verification state', () => {
  const user = new User({
    name: 'Ada',
    email: 'ada@example.com',
    password: 'hashed-password',
    role: 'jobseeker',
    emailVerificationToken: 'token',
    emailVerificationExpires: new Date(Date.now() + 60000)
  });

  assert.equal(user.emailVerified, false);
  assert.equal(user.emailVerificationToken, 'token');
  assert.ok(user.emailVerificationExpires instanceof Date);
  assert.equal(user.validateSync(), undefined);
});
