const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeMailError } = require('../utils/mailer');
const { buildInterviewIcs, buildInterviewNotificationContent } = require('../utils/interviewScheduling');

test('normalizeMailError rewrites Gmail auth failures to a safer message', () => {
  const normalized = normalizeMailError({
    code: 'EAUTH',
    message: 'Invalid login: 535-5.7.8 Username and Password not accepted. Learn more at https://support.google.com/mail/?p=BadCredentials'
  });

  assert.equal(normalized.code, 'SMTP_AUTH_FAILED');
  assert.equal(normalized.statusCode, 502);
  assert.match(normalized.message, /google app password/i);
});

test('normalizeMailError leaves unrelated mail errors unchanged', () => {
  const original = new Error('Connection timeout');
  const normalized = normalizeMailError(original);

  assert.equal(normalized, original);
});

test('buildInterviewIcs generates a calendar event with interview details', () => {
  const output = buildInterviewIcs({
    jobTitle: 'Backend Engineer',
    companyName: 'Acme Labs',
    candidateName: 'Fred',
    interview: {
      scheduledAt: '2026-06-01T10:00:00.000Z',
      duration: 45,
      type: 'technical',
      interviewer: 'Jane Doe',
      location: 'Zoom',
      meetingLink: 'https://meet.example.com/abc'
    },
    inviteUrl: 'https://api.example.com/invite',
    applicationUrl: 'https://app.example.com/my-applications'
  });

  assert.match(output, /BEGIN:VCALENDAR/);
  assert.match(output, /SUMMARY:Backend Engineer interview with Acme Labs/);
  assert.match(output, /Meeting link: https:\/\/meet.example.com\/abc/);
});

test('buildInterviewNotificationContent returns action-specific messaging', () => {
  const scheduled = buildInterviewNotificationContent({
    action: 'scheduled',
    jobTitle: 'Backend Engineer',
    interview: { scheduledAt: '2026-06-01T10:00:00.000Z' }
  });
  const cancelled = buildInterviewNotificationContent({
    action: 'cancelled',
    jobTitle: 'Backend Engineer',
    interview: {}
  });

  assert.match(scheduled, /scheduled/i);
  assert.match(cancelled, /cancelled/i);
});
