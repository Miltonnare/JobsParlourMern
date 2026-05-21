const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Job = require('../models/jobModel');

test('job applications store bid, ATS, resume, and candidate snapshot data', () => {
  const applicantId = new mongoose.Types.ObjectId();
  const employerId = new mongoose.Types.ObjectId();
  const job = new Job({
    title: 'React Developer',
    description: 'Build dashboards with React and Node.',
    location: 'Remote',
    createdBy: employerId,
    applications: [{
      user: applicantId,
      note: 'I can start next week.',
      resumeUrl: 'https://res.cloudinary.com/demo/raw/upload/resume.pdf',
      bid: {
        amount: 75000,
        currency: 'USD',
        type: 'monthly',
        estimatedDuration: '3 months',
        availability: 'Immediate'
      },
      ats: {
        score: 82,
        matchedKeywords: ['react', 'node'],
        missingKeywords: ['dashboard'],
        summary: '82% match'
      },
      candidateSnapshot: {
        name: 'Grace',
        email: 'grace@example.com',
        skills: ['React', 'Node']
      }
    }]
  });

  assert.equal(job.applications[0].bid.amount, 75000);
  assert.equal(job.applications[0].ats.score, 82);
  assert.deepEqual(job.applications[0].candidateSnapshot.skills, ['React', 'Node']);
  assert.equal(job.validateSync(), undefined);
});
