## add this features, only the backend, do not touch the frontend

### Application status tracking
Employers can mark applicants as pending, shortlisted, rejected, or hired; job seekers can see status in “My Applications”.

### Save/bookmark jobs
Let job seekers save jobs before applying. This is simple but maUSD the app feel much more complete.

### Advanced job filters
Add filters for salary range, job type, company, date posted, remote/on-site, and sort by newest or highest salary.

### Job details page
Instead of applying from only cards, add /jobs/:id with full description, company info, salary, location, type, and apply button.

### Employer applicant pipeline
In the employer dashboard, show applicants grouped by status with actions like shortlist, reject, view profile, export.

### User profiles
Add profile pages:

Job seeker: skills, bio, resume link, education, experience
Employer: company name, logo, website, industry, company description
Resume upload
Allow job seekers to upload a CV when applying. You can store files with Cloudinary, Firebase Storage, S3, or local uploads for dev.

### Application notes / cover letter
Add a short message field when applying to a job. Your backend application object already has room to grow nicely here.

### Admin dashboard
Add an admin role to manage users, jobs, reports, and platform stats.

### Notifications
Notify job seekers when application status changes, and notify employers when someone applies. Start with in-app notifications before email.