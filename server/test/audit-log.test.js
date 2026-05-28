const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AuditLog = require('../models/auditLogModel');
const auditLogger = require('../utils/auditLogger');

test('audit log model accepts actor, entity, and metadata fields', () => {
  const auditLog = new AuditLog({
    actor: new mongoose.Types.ObjectId(),
    actorName: 'Owner User',
    actorRole: 'employer:owner',
    companyId: new mongoose.Types.ObjectId(),
    action: 'job.created',
    entityType: 'job',
    entityId: String(new mongoose.Types.ObjectId()),
    jobId: new mongoose.Types.ObjectId(),
    metadata: {
      title: 'Backend Engineer'
    },
    ipAddress: '127.0.0.1',
    userAgent: 'node-test'
  });

  assert.equal(auditLog.action, 'job.created');
  assert.equal(auditLog.entityType, 'job');
  assert.equal(auditLog.metadata.title, 'Backend Engineer');
  assert.equal(auditLog.validateSync(), undefined);
});

test('createAuditLog writes normalized request context', async () => {
  const capturedEntries = [];
  const originalCreate = AuditLog.create;
  AuditLog.create = async (entry) => {
    capturedEntries.push(entry);
    return entry;
  };

  try {
    await auditLogger.createAuditLog({
      ip: '10.0.0.8',
      headers: { 'user-agent': 'audit-test-agent' },
      user: {
        _id: new mongoose.Types.ObjectId(),
        _idString: 'unused',
        name: 'Billing Owner',
        role: 'employer',
        employerRole: 'owner',
        companyId: new mongoose.Types.ObjectId()
      }
    }, {
      action: 'billing.payment_initialized',
      entityType: 'payment',
      entityId: new mongoose.Types.ObjectId(),
      metadata: { purpose: 'subscription' }
    });
  } finally {
    AuditLog.create = originalCreate;
  }

  assert.equal(capturedEntries.length, 1);
  assert.equal(capturedEntries[0].actorName, 'Billing Owner');
  assert.equal(capturedEntries[0].actorRole, 'employer:owner');
  assert.equal(capturedEntries[0].action, 'billing.payment_initialized');
  assert.equal(capturedEntries[0].ipAddress, '10.0.0.8');
  assert.equal(capturedEntries[0].userAgent, 'audit-test-agent');
});
