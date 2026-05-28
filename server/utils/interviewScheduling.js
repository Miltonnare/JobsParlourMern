const toUtcStamp = (value) => new Date(value)
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');

const escapeIcsText = (value = '') => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const buildInterviewInviteUrl = ({ jobId, applicationId, interviewId }) =>
  `/api/jobs/${jobId}/applications/${applicationId}/interviews/${interviewId}/invite`;

const buildInterviewIcs = ({
  jobTitle,
  companyName,
  candidateName,
  interview,
  inviteUrl = '',
  applicationUrl = ''
}) => {
  const scheduledAt = new Date(interview.scheduledAt);
  const durationMinutes = Number(interview.duration || 30);
  const endsAt = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
  const summary = `${jobTitle} interview${companyName ? ` with ${companyName}` : ''}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JobsParlour//Interview Invite//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(`${jobTitle}-${scheduledAt.toISOString()}-${candidateName || 'candidate'}`)}`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(scheduledAt)}`,
    `DTEND:${toUtcStamp(endsAt)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText([
      `Interview type: ${interview.type || 'general'}`,
      interview.interviewer ? `Interviewer: ${interview.interviewer}` : '',
      interview.meetingLink ? `Meeting link: ${interview.meetingLink}` : '',
      interview.location ? `Location: ${interview.location}` : '',
      inviteUrl ? `Calendar invite: ${inviteUrl}` : '',
      applicationUrl ? `Application: ${applicationUrl}` : ''
    ].filter(Boolean).join('\n'))}`,
    `LOCATION:${escapeIcsText(interview.location || interview.meetingLink || 'Online')}`,
    interview.meetingLink ? `URL:${escapeIcsText(interview.meetingLink)}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);

  return lines.join('\r\n');
};

const buildInterviewNotificationContent = ({ action, jobTitle, interview }) => {
  const scheduledLabel = interview?.scheduledAt
    ? new Date(interview.scheduledAt).toLocaleString()
    : '';

  if (action === 'cancelled') {
    return `Your interview for ${jobTitle} has been cancelled.`;
  }
  if (action === 'rescheduled') {
    return `Your interview for ${jobTitle} has been rescheduled to ${scheduledLabel}.`;
  }
  return `An interview has been scheduled for ${jobTitle} on ${scheduledLabel}.`;
};

const buildInterviewEmail = ({ action, candidateName, jobTitle, companyName, interview, inviteUrl = '', applicationUrl = '' }) => {
  const label = action === 'cancelled'
    ? 'Interview cancelled'
    : action === 'rescheduled'
      ? 'Interview rescheduled'
      : 'Interview scheduled';
  const scheduledLabel = interview?.scheduledAt
    ? new Date(interview.scheduledAt).toLocaleString()
    : 'TBD';
  const subject = `${label}: ${jobTitle}${companyName ? ` at ${companyName}` : ''}`;
  const intro = action === 'cancelled'
    ? `Your interview for ${jobTitle} has been cancelled.`
    : action === 'rescheduled'
      ? `Your interview for ${jobTitle} has been rescheduled.`
      : `Your interview for ${jobTitle} has been scheduled.`;

  const details = [
    `Date and time: ${scheduledLabel}`,
    `Interview type: ${interview?.type || 'general'}`,
    interview?.interviewer ? `Interviewer: ${interview.interviewer}` : '',
    interview?.location ? `Location: ${interview.location}` : '',
    interview?.meetingLink ? `Meeting link: ${interview.meetingLink}` : ''
  ].filter(Boolean);

  return {
    subject,
    text: [
      `Hi ${candidateName || 'there'},`,
      '',
      intro,
      '',
      ...details,
      inviteUrl ? `Calendar invite: ${inviteUrl}` : '',
      applicationUrl ? `Application tracker: ${applicationUrl}` : '',
      '',
      'Jobs Parlour'
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155;">
        <h2>${label}</h2>
        <p>Hi ${escapeIcsText(candidateName || 'there')},</p>
        <p>${escapeIcsText(intro)}</p>
        <ul>
          ${details.map((detail) => `<li>${escapeIcsText(detail)}</li>`).join('')}
        </ul>
        ${inviteUrl ? `<p><a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Download calendar invite</a></p>` : ''}
        ${applicationUrl ? `<p><a href="${applicationUrl}">Open your application tracker</a></p>` : ''}
      </div>
    `
  };
};

module.exports = {
  buildInterviewInviteUrl,
  buildInterviewIcs,
  buildInterviewNotificationContent,
  buildInterviewEmail
};
