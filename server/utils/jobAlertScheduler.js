const cron = require('node-cron');
const JobAlert = require('../models/jobAlertModel');
const Job = require('../models/jobModel');
const Notification = require('../models/notificationModel');
const { sendJobAlertDigestEmail } = require('./mailer');

const runJobAlerts = async () => {
  console.log('[Scheduler] Running Job Alerts check...');
  try {
    const activeAlerts = await JobAlert.find({ isActive: true, alertEnabled: true }).populate('userId');

    for (const alert of activeAlerts) {
      if (!alert.userId) {
        // User no longer exists, deactivate or delete alert
        continue;
      }

      // Check frequency timing
      if (alert.frequency === 'weekly' && alert.lastSent) {
        const diffMs = Date.now() - new Date(alert.lastSent).getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays < 6.9) {
          // Less than 7 days since last sent, skip
          continue;
        }
      }

      // Build search query for matching jobs
      const query = {
        status: 'active',
        createdAt: { $gt: alert.lastSent },
        _id: { $nin: alert.sentJobs || [] }
      };

      const conditions = [];

      if (alert.keywords && alert.keywords.length > 0) {
        conditions.push({
          $or: alert.keywords.map(kw => ({
            $or: [
              { title: { $regex: kw, $options: 'i' } },
              { description: { $regex: kw, $options: 'i' } }
            ]
          }))
        });
      }

      if (alert.categories && alert.categories.length > 0) {
        conditions.push({
          $or: alert.categories.map(cat => ({
            $or: [
              { title: { $regex: cat, $options: 'i' } },
              { description: { $regex: cat, $options: 'i' } },
              { jobType: { $regex: cat, $options: 'i' } }
            ]
          }))
        });
      }

      if (alert.locations && alert.locations.length > 0) {
        conditions.push({
          $or: alert.locations.map(loc => ({
            $or: [
              { location: { $regex: loc, $options: 'i' } },
              { workplace: { $regex: loc, $options: 'i' } }
            ]
          }))
        });
      }

      if (conditions.length > 0) {
        query.$and = conditions;
      }

      const matchingJobs = await Job.find(query).populate('createdBy');

      if (matchingJobs.length > 0) {
        try {
          // Send email digest
          await sendJobAlertDigestEmail({
            to: alert.userId.email,
            name: alert.userId.name,
            jobs: matchingJobs
          });

          // Create notification record
          await Notification.create({
            user: alert.userId._id,
            type: 'job_alert',
            message: `We found ${matchingJobs.length} new job${matchingJobs.length === 1 ? '' : 's'} matching your saved job alert.`
          });

          // Update alert state
          alert.lastSent = new Date();
          alert.lastMatchedCount = matchingJobs.length;
          if (!alert.sentJobs) alert.sentJobs = [];
          alert.sentJobs.push(...matchingJobs.map(job => job._id));
          await alert.save();

          console.log(`[Scheduler] Sent alert digest to user ${alert.userId.email} with ${matchingJobs.length} jobs.`);
        } catch (mailError) {
          console.error(`[Scheduler] Failed to send job alert email to ${alert.userId.email}:`, mailError);
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error running job alerts:', error);
  }
};

const initScheduler = () => {
  // Run daily at midnight
  cron.schedule('0 0 * * *', () => {
    runJobAlerts();
  });
  console.log('[Scheduler] Job Alert email digest scheduler initialized to run daily at midnight.');
};

module.exports = {
  runJobAlerts,
  initScheduler
};
