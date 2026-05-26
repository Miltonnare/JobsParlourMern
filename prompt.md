## Real business features
- Employer team accounts: company owner, recruiter, hiring manager roles.
- Interview pipeline: schedule interview, interviewer notes, stage history, candidate timeline.
- Messaging/chat between employer and applicant.
- Saved searches and job alerts for job seekers.
- Resume parsing and profile completeness scoring.
- Subscription enforcement middleware so plan limits actually control posting, applying, exporting, and boosts.
- Billing portal: invoices, payment history, failed-payment retries, plan upgrades/downgrades, cancellations.
- Featured jobs and boosted profiles with expiry windows and analytics.



1. Stripe Subscriptions (recurring mont hly/yearly)
## Job Alert Email System

**Summary**: An automated email system that notifies job seekers of new jobs matching their saved preferences.

### 1. Components

* **Job Alerts**: A new data model (`JobAlert`) to store user preferences (keywords, categories, locations, frequency).
* **Scheduler**: A recurring job (e.g., using `node-cron` or Bull/Agenda) that runs daily.
* **Email Service**: A service to send emails (using Nodemailer or SendGrid).
* **Notification Center**: Updates the existing notification system to include "Job Alert" types.

### 2. Features

* **Creation**: Users can create alerts with specific criteria.
* **Frequency**: Options for Daily, Weekly, or Instant (if feasible).
* **Digest Logic**:
    * **Daily**: Sends all jobs matching the criteria since the last email.
    * **Weekly**: Sends a summary of all jobs from the week.
* **Uniqueness**:
    * Ensure a specific job is sent only once to a specific alert subscription.

### 3. Workflow

1. **Scheduler** runs at the configured interval.
2. **Fetch Alerts**: Retrieves active `JobAlert` records.
3. **Query Jobs**: For each alert, queries the `Job` collection for new/matching jobs.
4. **Generate Content**: Creates a personalized email body/digest.
5. **Send Email**: Sends the email via the Email Service.
6. **Record Notification**: Logs the action in the `Notification` collection.
7. **Update Last Sent**: Updates the `lastSent` timestamp on the `JobAlert` record.

### 4. Database Schema (`JobAlert`)

```javascript
{
  userId: String,
  keywords: [String],
  categories: [String],
  locations: [String], // City/Remote/Hybrid
  frequency: String, // 'daily' | 'weekly'
  isActive: Boolean,
  lastSent: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 5. Implementation Details

* **Performance**: Consider using MongoDB aggregation pipelines to efficiently query matching jobs and avoid N+1 query problems.
* **User Control**: Add an endpoint to allow users to pause or delete alerts.

---
