const test = require('node:test');
const assert = require('node:assert/strict');
const { hasEmployerCapability } = require('../middleware/capabilityMiddleware');
const { validate, stringField, numberField, booleanField, idField } = require('../middleware/validationMiddleware');

test('employer capabilities distinguish owner, recruiter, and hiring manager access', () => {
  const owner = { role: 'employer', _id: 'owner-id' };
  const recruiter = { role: 'employer', companyId: 'owner-id', employerRole: 'recruiter' };
  const hiringManager = { role: 'employer', companyId: 'owner-id', employerRole: 'hiring_manager' };

  assert.equal(hasEmployerCapability(owner, 'billing.manage'), true);
  assert.equal(hasEmployerCapability(recruiter, 'billing.manage'), false);
  assert.equal(hasEmployerCapability(recruiter, 'jobs.create'), true);
  assert.equal(hasEmployerCapability(hiringManager, 'jobs.create'), false);
  assert.equal(hasEmployerCapability(hiringManager, 'applications.advance'), true);
});

test('validation middleware sanitizes valid input payloads', async () => {
  const middleware = validate({
    body: [
      stringField('title', { required: true, minLength: 2 }),
      numberField('salary', { min: 0 }),
      booleanField('featured'),
      idField('jobId', { required: true })
    ]
  });

  const req = {
    body: {
      title: '  Backend Engineer  ',
      salary: '120000',
      featured: 'true',
      jobId: '507f1f77bcf86cd799439011'
    }
  };

  await new Promise((resolve, reject) => {
    middleware(req, {}, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  assert.equal(req.body.title, 'Backend Engineer');
  assert.equal(req.body.salary, 120000);
  assert.equal(req.body.featured, true);
});

test('validation middleware rejects invalid identifiers and enums with 400 errors', async () => {
  const middleware = validate({
    params: [idField('jobId', { required: true, label: 'job id' })],
    body: [stringField('status', { required: true, enum: ['pending', 'shortlisted'] })]
  });

  const req = {
    params: { jobId: 'not-a-mongo-id' },
    body: { status: 'rejected' }
  };

  const error = await new Promise((resolve) => {
    middleware(req, {}, (nextError) => resolve(nextError));
  });

  assert.equal(error.statusCode, 400);
  assert.match(error.message, /status/i);

  const invalidIdReq = {
    params: { jobId: 'not-a-mongo-id' },
    body: { status: 'pending' }
  };

  const idError = await new Promise((resolve) => {
    middleware(invalidIdReq, {}, (nextError) => resolve(nextError));
  });

  assert.equal(idError.statusCode, 400);
  assert.match(idError.message, /job id/i);
});
