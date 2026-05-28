
const Job = require('../models/jobModel');
const User = require('../models/userModel');
const Notification = require('../models/notificationModel');
const Report = require('../models/reportModel');
const { bumpUsageValue } = require('../middleware/subscriptionMiddleware');
const { buildResumeRecordFromUpload } = require('../utils/resumeLibrary');
const { createAuditLog } = require('../utils/auditLogger');
const { sendInterviewUpdateEmail } = require('../utils/mailer');
const {
  buildInterviewInviteUrl,
  buildInterviewIcs,
  buildInterviewNotificationContent,
  buildInterviewEmail
} = require('../utils/interviewScheduling');

const STOP_WORDS = new Set([
  'and','or','the','a','an','to','of','in','for','with','on','at','by','from','is','are','be','as','we','you',
  'your','our','this','that','will','can','have','has','job','role','work','team','candidate','experience'
]);

const tokenize = (value = '') => String(value)
  .toLowerCase()
  .replace(/[^a-z0-9+#. ]/g, ' ')
  .split(/\s+/)
  .map(token => token.trim())
  .filter(token => token.length > 2 && !STOP_WORDS.has(token));

const unique = (items) => [...new Set(items)];
const ATS_STAGES = ['applied','screening','interviewing','offered','hired','rejected'];
const APPLICATION_STATUSES = ['pending','shortlisted','rejected','hired'];

const calculateAtsScore = (job, candidate, note = '', resumeText = '') => {
  const jobKeywords = unique(tokenize(`${job.title} ${job.description} ${job.jobType} ${job.location}`)).slice(0, 30);
  const candidateText = [
    candidate.bio,
    candidate.education,
    candidate.experience,
    resumeText,
    note,
    ...(candidate.skills || [])
  ].join(' ');
  const candidateKeywords = new Set(tokenize(candidateText));
  const matchedKeywords = jobKeywords.filter(keyword => candidateKeywords.has(keyword));
  const missingKeywords = jobKeywords.filter(keyword => !candidateKeywords.has(keyword)).slice(0, 10);
  const keywordScore = jobKeywords.length ? Math.round((matchedKeywords.length / jobKeywords.length) * 85) : 0;
  const profileBonus = Math.min([
    candidate.resumeUrl,
    candidate.experience,
    candidate.education,
    candidate.skills?.length,
    note
  ].filter(Boolean).length * 3, 15);
  const score = Math.min(keywordScore + profileBonus, 100);

  return {
    score,
    matchedKeywords: matchedKeywords.slice(0, 15),
    missingKeywords,
    summary: `${score}% match based on ${matchedKeywords.length} matched keyword${matchedKeywords.length === 1 ? '' : 's'} and profile completeness.`
  };
};

const getEmployerRootId = (currentUser) => currentUser.companyId || currentUser._id;

const ensureEmployerOwnsJob = (job, currentUser) => {
  if (job.createdBy.toString() !== getEmployerRootId(currentUser).toString()) {
    const error = new Error('Not authorized to manage this job');
    error.statusCode = 403;
    throw error;
  }
};

const deriveStatusFromStage = (stage = 'applied') => {
  if (stage === 'rejected') return 'rejected';
  if (stage === 'hired') return 'hired';
  if (['screening', 'interviewing', 'offered'].includes(stage)) return 'shortlisted';
  return 'pending';
};

const mapApplicationForEmployer = (app = {}) => ({
  _id: app._id,
  applicantId: app.user,
  appliedAt: app.appliedAt,
  status: app.status || 'pending',
  archived: Boolean(app.archived),
  archivedAt: app.archivedAt || null,
  note: app.note,
  resumeUrl: app.resumeUrl,
  resumeText: app.resumeText,
  bid: app.bid || {},
  ats: app.ats || {},
  candidateSnapshot: app.candidateSnapshot || {},
  stage: app.stage || 'applied',
  interviews: app.interviews || [],
  notes: app.notes || [],
  stageHistory: app.stageHistory || []
});

const buildAtsSummary = (applications = []) => {
  const summary = {
    totalApplicants: applications.length,
    activeApplicants: applications.filter((app) => !app.archived).length,
    archivedApplicants: applications.filter((app) => app.archived).length,
    averageAtsScore: 0,
    interviewsScheduled: 0,
    hiredCount: 0,
    stageCounts: ATS_STAGES.reduce((acc, stage) => ({ ...acc, [stage]: 0 }), {}),
    statusCounts: APPLICATION_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {})
  };

  const scores = applications.map((app) => Number(app.ats?.score || 0)).filter((score) => Number.isFinite(score));
  summary.averageAtsScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;

  applications.forEach((application) => {
    const stage = application.stage || 'applied';
    const status = application.status || deriveStatusFromStage(stage);
    summary.stageCounts[stage] = Number(summary.stageCounts[stage] || 0) + 1;
    summary.statusCounts[status] = Number(summary.statusCounts[status] || 0) + 1;
    summary.interviewsScheduled += Array.isArray(application.interviews) ? application.interviews.length : 0;
    if (stage === 'hired' || status === 'hired') summary.hiredCount += 1;
  });

  return summary;
};

const sortApplications = (applications = [], sort = 'newest') => {
  const sorted = [...applications];
  sorted.sort((left, right) => {
    if (sort === 'ats-high') return Number(right.ats?.score || 0) - Number(left.ats?.score || 0);
    if (sort === 'ats-low') return Number(left.ats?.score || 0) - Number(right.ats?.score || 0);
    if (sort === 'bid-high') return Number(right.bid?.amount || 0) - Number(left.bid?.amount || 0);
    if (sort === 'bid-low') return Number(left.bid?.amount || 0) - Number(right.bid?.amount || 0);
    if (sort === 'oldest') return new Date(left.appliedAt || 0) - new Date(right.appliedAt || 0);
    return new Date(right.appliedAt || 0) - new Date(left.appliedAt || 0);
  });
  return sorted;
};

const buildPipeline = (applications = []) => ATS_STAGES.reduce((acc, stage) => {
  acc[stage] = applications.filter((application) => (application.stage || 'applied') === stage);
  return acc;
}, {});

const isFeaturedActive = (job) => Boolean(job.isFeatured && job.featuredUntil && new Date(job.featuredUntil) > new Date());
const SUSPICIOUS_PATTERNS = [
  { pattern: /\b(pay\s*(a|an)?\s*fee|registration fee|processing fee)\b/i, reason: 'Mentions candidate fee or upfront payment', score: 4 },
  { pattern: /\bwhatsapp\b/i, reason: 'Uses WhatsApp as primary recruitment channel', score: 2 },
  { pattern: /\btelegram\b/i, reason: 'Uses Telegram as primary recruitment channel', score: 2 },
  { pattern: /\burgent hire\b/i, reason: 'Uses urgent-hire pressure language', score: 1 },
  { pattern: /\bno experience needed\b/i, reason: 'Uses low-friction hiring language', score: 1 },
  { pattern: /\bwire transfer|crypto payment|bitcoin\b/i, reason: 'Mentions risky payment method', score: 5 }
];

const evaluateJobModeration = ({ title = '', description = '', salary, workplace = '' }) => {
  const reasons = [];
  let suspiciousScore = 0;
  const combinedText = `${title}\n${description}\n${workplace}`;

  SUSPICIOUS_PATTERNS.forEach(({ pattern, reason, score }) => {
    if (pattern.test(combinedText)) {
      reasons.push(reason);
      suspiciousScore += score;
    }
  });

  const salaryNumber = Number(salary || 0);
  if (salaryNumber > 0 && salaryNumber >= 1000000) {
    reasons.push('Salary is unusually high and should be reviewed');
    suspiciousScore += 2;
  }

  return {
    isFlagged: suspiciousScore >= 3,
    suspiciousScore,
    reasons,
    lastFlaggedAt: suspiciousScore >= 3 ? new Date() : undefined,
    reviewStatus: suspiciousScore >= 3 ? 'reviewing' : 'none'
  };
};

const getClientBaseUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const getApiBaseUrl = () => {
  const apiUrl = process.env.API_URL || process.env.SERVER_URL || 'http://localhost:5000';
  return apiUrl.replace(/\/$/, '');
};

const buildApplicationTrackerUrl = (jobId) => `${getClientBaseUrl()}/my-applications?jobId=${jobId}`;

const sendInterviewUpdateSideEffects = async ({
  action,
  applicant,
  application,
  interview,
  job,
  actorName
}) => {
  if (!applicant?.email) return;

  const invitePath = buildInterviewInviteUrl({
    jobId: job._id,
    applicationId: application._id,
    interviewId: interview._id
  });
  const inviteUrl = `${getApiBaseUrl()}${invitePath}`;
  const applicationUrl = buildApplicationTrackerUrl(job._id);
  const companyName = job.createdBy?.companyName || job.createdBy?.name || '';

  await Notification.create({
    user: applicant._id,
    type: 'system',
    message: buildInterviewNotificationContent({ action, jobTitle: job.title, interview }),
    link: `/my-applications?jobId=${job._id}`,
    metadata: {
      jobId: String(job._id),
      applicationId: String(application._id),
      interviewId: String(interview._id),
      action,
      inviteUrl: invitePath,
      scheduledAt: interview.scheduledAt ? new Date(interview.scheduledAt).toISOString() : '',
      actorName: actorName || ''
    }
  });

  const emailPayload = buildInterviewEmail({
    action,
    candidateName: applicant.name,
    jobTitle: job.title,
    companyName,
    interview,
    inviteUrl,
    applicationUrl
  });

  try {
    await sendInterviewUpdateEmail({
      to: applicant.email,
      ...emailPayload
    });
  } catch (error) {
    console.error('Interview email delivery failed:', error.message);
  }
};

const createJob=async (req,res)=>{
    const {title,description,location,jobType,Type,salary,workplace,status}=req.body;

    if(!title||!location){
        return res.status(400).json({message:"Title and Location are mandatory"});
    }

    const moderation = evaluateJobModeration({
      title,
      description,
      salary,
      workplace: workplace || 'onsite'
    });
    const newJob=await Job.create({
        title,
        description,
        location,
        jobType:jobType || Type || 'full-time',
        salary,
        workplace:workplace || 'onsite',
        status:status || 'active',
        createdBy:req.user.companyId || req.user._id,
        moderation


    });
    if (moderation.isFlagged) {
      await User.findByIdAndUpdate(req.user.companyId || req.user._id, {
        $inc: { 'trustFlags.suspiciousJobCount': 1 },
        $set: { 'trustFlags.lastFlaggedAt': new Date() }
      });
    }
    await createAuditLog(req,{
      action:'job.created',
      entityType:'job',
      entityId:newJob._id,
      jobId:newJob._id,
      metadata:{ title:newJob.title, status:newJob.status, flagged: moderation.isFlagged }
    });

    res.status(201).json(newJob);
};


const getAllJobs=async (req,res)=>{
    const {
      search,
      jobType,
      location,
      company,
      workplace,
      status='active',
      minSalary,
      maxSalary,
      dateFrom,
      dateTo,
      postedWithin,
      sort='newest',
      page=1,
      limit=12
    }=req.query;

    const query={};
    if(company){
      const matchingCompanies=await User.find({
        role:'employer',
        $or:[
          {companyName:new RegExp(company,'i')},
          {name:new RegExp(company,'i')}
        ]
      }).select('_id');

      query.createdBy={ $in: matchingCompanies.map(employer=>employer._id) };
    }
    if(status!=='all') query.status=status;
    if(jobType && jobType!=='all') query.jobType=jobType;
    if(workplace && workplace!=='all') query.workplace=workplace;
    if(location && location!=='all') query.location=new RegExp(location,'i');
    if(dateFrom || dateTo || postedWithin){
      query.createdAt={};
      if(dateFrom) query.createdAt.$gte=new Date(dateFrom);
      if(dateTo) query.createdAt.$lte=new Date(dateTo);
      if(postedWithin){
        const days=Number(postedWithin);
        if(!Number.isNaN(days)){
          query.createdAt.$gte=new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        }
      }
    }
    if(minSalary || maxSalary){
      query.salary={};
      if(minSalary) query.salary.$gte=Number(minSalary);
      if(maxSalary) query.salary.$lte=Number(maxSalary);
    }
    if(search){
      query.$or=[
        {title:new RegExp(search,'i')},
        {description:new RegExp(search,'i')},
        {location:new RegExp(search,'i')}
      ];
    }

    let sortBy={createdAt:-1};
    if(sort==='salary-high') sortBy={salary:-1};
    if(sort==='salary-low') sortBy={salary:1};
    if(sort==='oldest') sortBy={createdAt:1};

    const safePage=Math.max(Number(page),1);
    const safeLimit=Math.min(Math.max(Number(limit),1),50);

    const [jobs,total]=await Promise.all([
      Job.find(query)
        .populate('createdBy','name companyName companyLogo industry companyWebsite companyDescription')
        .sort({ isFeatured: -1, featuredUntil: -1, ...sortBy })
        .skip((safePage-1)*safeLimit)
        .limit(safeLimit),
      Job.countDocuments(query)
    ]);

    const mappedJobs = jobs.map(job => {
      const raw = job.toObject();
      raw.isFeaturedActive = isFeaturedActive(raw);
      if (raw.isFeaturedActive) {
        raw.featuredAnalytics = raw.featuredAnalytics || {};
      }
      return raw;
    });

    res.json({
      jobs:mappedJobs,
      total,
      page:safePage,
      pages:Math.max(Math.ceil(total/safeLimit),1)
    });
};

const getJobById=async (req,res)=>{
    const job=await Job.findById(req.params.id).populate('createdBy','name email companyName companyLogo companyWebsite industry companyDescription');

    if(!job) return res.status(404).json({message:'Job Not Found'});

    job.views = Number(job.views || 0) + 1;
    if (isFeaturedActive(job)) {
      job.featuredAnalytics = {
        ...(job.featuredAnalytics || {}),
        impressions: Number(job.featuredAnalytics?.impressions || 0) + 1,
        clicks: Number(job.featuredAnalytics?.clicks || 0),
        lastFeaturedAt: job.featuredAnalytics?.lastFeaturedAt || job.featuredActivatedAt || new Date()
      };
    }
    await job.save();

    res.json(job);
};

const updateJob=async (req,res)=>{
    const job=await Job.findById(req.params.id);

    if(!job) return res.status(404).json({message:'Job Not Found'});

    if(job.createdBy.toString()!==(req.user.companyId || req.user._id).toString()){
        return res.status(403).json({message:"Not Authorized to Update this Job"});
    }

    const payload={...req.body};
    if(payload.Type && !payload.jobType) payload.jobType=payload.Type;
    delete payload.Type;

    const moderation = evaluateJobModeration({
      title: payload.title ?? job.title,
      description: payload.description ?? job.description,
      salary: payload.salary ?? job.salary,
      workplace: payload.workplace ?? job.workplace
    });
    payload.moderation = {
      ...(job.moderation || {}),
      ...moderation
    };

    const updated=await Job.findByIdAndUpdate(req.params.id,
        payload,
      { new: true } 
    );
    await createAuditLog(req,{
      action:'job.updated',
      entityType:'job',
      entityId:updated._id,
      jobId:updated._id,
      metadata:{ fields:Object.keys(payload), flagged: payload.moderation.isFlagged }
    });

    res.json(updated);
}

const deleteJob=async (req,res)=>{
    const job=await Job.findById(req.params.id);
    if(!job) {
        return res.status(404).json({message:"Job Not Found"})
    };

    if (job.createdBy.toString() !== (req.user.companyId || req.user._id).toString()) {
    return res.status(403).json({ message: "Not authorized to delete this job" });
  };

  await Job.deleteOne({ _id: req.params.id });
  await createAuditLog(req,{
    action:'job.deleted',
    entityType:'job',
    entityId:req.params.id,
    jobId:req.params.id,
    metadata:{ title:job.title }
  });
  res.json({ message: "Job deleted" });
};

const applyToJob = async (req, res) => {
  const jobId = req.params.id;
  const userId = req.user._id;

  const {
    note='',
    profileResumeId,
    resumeUrl='',
    resumeText='',
    bidAmount,
    bidCurrency='USD',
    bidType='fixed',
    estimatedDuration='',
    availability
  }=req.body;
  const job = await Job.findById(jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  if (job.status === 'closed') return res.status(400).json({ message: 'This job is closed' });


  const alreadyApplied = job.applications.find(app => app.user.toString() === userId.toString());
  if (alreadyApplied) return res.status(400).json({ message: 'You already applied for this job' });

  let selectedResume = null;
  if (profileResumeId) {
    selectedResume = req.user.resumes?.id(profileResumeId);
    if (!selectedResume) {
      return res.status(400).json({ message: 'Selected profile resume was not found' });
    }
  }

  let uploadedApplicationResume = null;
  if (req.file) {
    uploadedApplicationResume = await buildResumeRecordFromUpload({
      file:req.file,
      ownerId:req.user._id,
      folderSuffix:`applications/${jobId}`,
      manualResumeText:resumeText,
      label:req.body.label || `${job.title} application`
    });
  }

  const resolvedResumeUrl = uploadedApplicationResume?.resumeUrl
    || selectedResume?.resumeUrl
    || resumeUrl
    || req.user.resumeUrl
    || '';
  const resolvedResumeText = uploadedApplicationResume?.resumeText
    || selectedResume?.resumeText
    || resumeText
    || req.user.resumeText
    || '';
  const bidAmountNumber=bidAmount === '' || bidAmount === undefined ? req.user.expectedRate : Number(bidAmount);
  const bid = {
    amount: Number.isFinite(bidAmountNumber) ? bidAmountNumber : undefined,
    currency: bidCurrency,
    type: bidType,
    estimatedDuration,
    availability: availability || req.user.availability || ''
  };
  const candidateSnapshot = {
    name: req.user.name,
    email: req.user.email,
    bio: req.user.bio || '',
    skills: req.user.skills || [],
    education: req.user.education || '',
    experience: req.user.experience || '',
    resumeUrl: resolvedResumeUrl,
    expectedRate: req.user.expectedRate,
    availability: req.user.availability || ''
  };
  const ats = calculateAtsScore(job, candidateSnapshot, note, resolvedResumeText);

  job.applications.push({
    user: userId,
    note,
    resumeUrl: resolvedResumeUrl,
    resumeText: resolvedResumeText,
    bid,
    ats,
    candidateSnapshot,
    stageHistory: [{
      stage: 'applied',
      updatedBy: userId,
      updatedByName: req.user.name,
      updatedAt: new Date()
    }]
  });
  job.applicationCount = (job.applicationCount || 0) + 1;
  await job.save();

  await Notification.create({
    user:job.createdBy,
    type:'application',
    message:`${req.user.name} applied for ${job.title}${bid.amount ? ` with a ${bid.currency} ${bid.amount} bid` : ''}`
  });

  res.status(200).json({ message: 'Application successful' });
};


const getMyApplications = async (req, res) => {
  const userId = req.user._id;
  try {
    const jobs = await Job.find({ 'applications.user': userId })
      .populate('createdBy', 'name companyName')
      .populate('applications.user', 'name email');
    const Message = require('../models/messageModel');

    const myApplicationIds = jobs.flatMap((job) => (
      job.applications
        .filter((application) => String(application.user?._id || application.user) === String(userId))
        .map((application) => application._id)
    ));

    const unreadMessages = await Message.aggregate([
      {
        $match: {
          receiver: userId,
          read: false,
          applicationId: { $in: myApplicationIds }
        }
      },
      {
        $group: {
          _id: '$applicationId',
          count: { $sum: 1 }
        }
      }
    ]);
    const unreadByApplicationId = unreadMessages.reduce((acc, item) => {
      acc[String(item._id)] = item.count;
      return acc;
    }, {});

    const myApplications = [];
    jobs.forEach(job => {
      job.applications.forEach(app => {
        if (
          app.user &&
          app.user._id &&
          app.user._id.toString() === userId.toString()
        ) {
          myApplications.push({
            _id: app._id,
            job: {
              _id: job._id,
              title: job.title,
              description: job.description,
              companyName: job.createdBy?.companyName || '',
              location: job.location,
              salary: job.salary,
              jobType: job.jobType,
            },
            status: app.status || 'pending',
            note: app.note || '',
            resumeUrl: app.resumeUrl || '',
            bid: app.bid || {},
            ats: app.ats || {},
            stage: app.stage || 'applied',
            interviews: app.interviews || [],
            nextAction: (() => {
              const upcomingInterview = (app.interviews || [])
                .filter((interview) => interview.status === 'scheduled')
                .sort((left, right) => new Date(left.scheduledAt || 0) - new Date(right.scheduledAt || 0))[0];

              if (upcomingInterview) {
                return {
                  type: 'interview',
                  label: 'Prepare for your upcoming interview',
                  detail: `Interview scheduled for ${new Date(upcomingInterview.scheduledAt).toLocaleString()}`,
                  inviteUrl: buildInterviewInviteUrl({
                    jobId: job._id,
                    applicationId: app._id,
                    interviewId: upcomingInterview._id
                  })
                };
              }

              const unreadCount = unreadByApplicationId[String(app._id)] || 0;
              if (unreadCount > 0) {
                return {
                  type: 'message',
                  label: 'Reply to your unread messages',
                  detail: `${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'} from the hiring team`,
                  link: `/messages?jobId=${job._id}`
                };
              }

              if ((app.stage || 'applied') === 'offered') {
                return {
                  type: 'offer',
                  label: 'Review your offer status',
                  detail: 'Your application has moved to the offer stage.',
                  link: `/my-applications?jobId=${job._id}`
                };
              }

              return {
                type: 'wait',
                label: 'Keep your profile and resume ready',
                detail: 'No immediate action is required right now.',
                link: `/jobs/${job._id}`
              };
            })(),
            unreadMessages: unreadByApplicationId[String(app._id)] || 0,
            timeline: [
              {
                type: 'applied',
                title: 'Application Submitted',
                description: 'You submitted your application.',
                timestamp: app.appliedAt || app.createdAt || job.createdAt
              },
              ...(app.stageHistory || []).map((history) => ({
                type: 'stage_change',
                title: `Moved to ${String(history.stage || '').toUpperCase()}`,
                description: `Updated by ${history.updatedByName || 'Employer'}`,
                timestamp: history.updatedAt
              })),
              ...(app.interviews || []).map((interview) => ({
                type: 'interview',
                title: `Interview (${interview.type || 'general'})`,
                description: `Scheduled with ${interview.interviewer || 'Interviewer'} on ${new Date(interview.scheduledAt).toLocaleString()}`,
                timestamp: interview.scheduledAt
              }))
            ].sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp)),
            createdAt: app.appliedAt || app.createdAt || job.createdAt,
          });
        }
      });
    });

    res.json(myApplications);
  } catch (error) {
    console.error('Error in getMyApplications:', error);
    res.status(500).json({ message: 'Failed to fetch applications.' });
  }
};

const  getMyApplicantsForEmployerByJobs=async (req,res)=>{
  try {
    const employerId = req.user.companyId || req.user._id; // use owner _id if part of team
    const {
      jobId,
      stage,
      status,
      search='',
      archived='active',
      sort='newest',
      minScore,
      maxScore
    } = req.query;

    // Find jobs created by this employer, and populate applications.user
    const jobs = await Job.find({
      createdBy: employerId,
      ...(jobId ? { _id: jobId } : {})
    })
      .populate('applications.user', 'name email');

    const jobsWithApplicants = jobs.map(job => {
      let applications=job.applications.map(mapApplicationForEmployer);

      applications = applications.filter((application) => {
        if (stage && stage !== 'all' && (application.stage || 'applied') !== stage) return false;
        if (status && status !== 'all' && (application.status || 'pending') !== status) return false;
        if (archived === 'archived' && !application.archived) return false;
        if (archived === 'active' && application.archived) return false;
        if (minScore !== undefined && Number(application.ats?.score || 0) < Number(minScore)) return false;
        if (maxScore !== undefined && Number(application.ats?.score || 0) > Number(maxScore)) return false;
        if (search) {
          const haystack = [
            application.applicantId?.name,
            application.applicantId?.email,
            application.candidateSnapshot?.bio,
            ...(application.candidateSnapshot?.skills || []),
            application.note
          ].join(' ').toLowerCase();
          if (!haystack.includes(String(search).toLowerCase())) return false;
        }
        return true;
      });

      applications = sortApplications(applications, sort);
      const pipeline = buildPipeline(applications);
      const summary = buildAtsSummary(applications);

      return {
        jobId: job._id,
        title: job.title,
        status: job.status,
        summary,
        applications,
        pipeline
      };
    });

    const overallApplications = jobsWithApplicants.flatMap((job) => job.applications);

    res.json({
      jobs: jobsWithApplicants,
      filters: {
        jobId: jobId || 'all',
        stage: stage || 'all',
        status: status || 'all',
        search: search || '',
        archived: archived || 'active',
        sort: sort || 'newest',
        minScore: minScore ?? '',
        maxScore: maxScore ?? ''
      },
      summary: buildAtsSummary(overallApplications)
    });
  } catch (err) {
    console.error('Error in getMyApplicantsForEmployerByJobs:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

const bulkUpdateApplications = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { applicationIds = [], action, stage, archived } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ message: 'applicationIds must be a non-empty array' });
    }
    if (!action || !['move_stage', 'archive', 'unarchive', 'set_status'].includes(action)) {
      return res.status(400).json({ message: 'Invalid bulk action' });
    }
    if (action === 'move_stage' && !ATS_STAGES.includes(stage)) {
      return res.status(400).json({ message: 'A valid stage is required for move_stage' });
    }
    if (action === 'set_status' && !APPLICATION_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: 'A valid status is required for set_status' });
    }

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    ensureEmployerOwnsJob(job, req.user);

    const updatedApplications = [];

    applicationIds.forEach((applicationId) => {
      const application = job.applications.id(applicationId);
      if (!application) return;

      if (action === 'move_stage') {
        application.stage = stage;
        application.status = deriveStatusFromStage(stage);
        application.archived = false;
        application.archivedAt = undefined;
        application.stageHistory.push({
          stage,
          updatedBy: req.user._id,
          updatedByName: req.user.name,
          updatedAt: new Date()
        });
      }

      if (action === 'set_status') {
        application.status = req.body.status;
      }

      if (action === 'archive' || (action === 'unarchive' && archived !== undefined)) {
        application.archived = action === 'archive' ? true : Boolean(archived);
        application.archivedAt = application.archived ? new Date() : undefined;
      }

      if (action === 'unarchive') {
        application.archived = false;
        application.archivedAt = undefined;
      }

      updatedApplications.push(application);
    });

    await job.save();
    await createAuditLog(req,{
      action:'applications.bulk_updated',
      entityType:'job',
      entityId:job._id,
      jobId:job._id,
      metadata:{
        action,
        stage:stage || '',
        status:req.body.status || '',
        updatedCount:updatedApplications.length
      }
    });

    res.json({
      message: `Updated ${updatedApplications.length} application${updatedApplications.length === 1 ? '' : 's'}`,
      updatedCount: updatedApplications.length,
      applications: updatedApplications
    });
  } catch (error) {
    console.error('Error in bulkUpdateApplications:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server Error' });
  }
};

const exportApplicantsCsv=async (req,res)=>{
  const jobs=await Job.find({createdBy: req.user.companyId || req.user._id}).populate('applications.user','name email');
  const rows=[
    ['Job Title','Applicant Name','Applicant Email','Status','Applied At','Bid Amount','Bid Currency','Bid Type','ATS Score','Matched Keywords','Resume URL','Note']
  ];

  jobs.forEach(job=>{
    job.applications.forEach(app=>{
      rows.push([
        job.title,
        app.user?.name || '',
        app.user?.email || '',
        app.status || 'pending',
        app.appliedAt ? app.appliedAt.toISOString() : '',
        app.bid?.amount || '',
        app.bid?.currency || '',
        app.bid?.type || '',
        app.ats?.score || 0,
        (app.ats?.matchedKeywords || []).join('; '),
        app.resumeUrl || '',
        app.note || ''
      ]);
    });
  });

  const csv=rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(',')).join('\n');

  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="applicants.csv"');
  if (req.subscriptionContext?.subscription) {
    await bumpUsageValue(req.subscriptionContext.subscription, 'applicantExports');
  }
  await createAuditLog(req,{
    action:'applications.exported',
    entityType:'job',
    entityId:'multiple',
    metadata:{ jobCount:jobs.length }
  });
  res.send(csv);
};

const updateApplicationStatus=async (req,res)=>{
  const {jobId,applicationId}=req.params;
  const {status}=req.body;
  const allowed=APPLICATION_STATUSES;
  if(!allowed.includes(status)) return res.status(400).json({message:'Invalid application status'});

  const job=await Job.findById(jobId);
  if(!job) return res.status(404).json({message:'Job not found'});
  if(job.createdBy.toString()!==(req.user.companyId || req.user._id).toString()) {
    return res.status(403).json({message:'Not authorized to update this application'});
  }

  const application=job.applications.id(applicationId);
  if(!application) return res.status(404).json({message:'Application not found'});

  application.status=status;
  if (status === 'rejected') {
    application.stage = 'rejected';
  } else if (status === 'hired') {
    application.stage = 'hired';
  } else if (status === 'shortlisted' && application.stage === 'applied') {
    application.stage = 'screening';
  }
  application.archived = false;
  application.archivedAt = undefined;
  await job.save();
  await createAuditLog(req,{
    action:'application.status_updated',
    entityType:'application',
    entityId:application._id,
    jobId:job._id,
    applicationId:application._id,
    targetUser:application.user,
    metadata:{ status }
  });

  await Notification.create({
    user:application.user,
    type:'status',
    message:`Your application for ${job.title} is now ${status}`
  });

  res.json({message:'Application status updated',application});
};

const toggleJobStatus=async (req,res)=>{
  const job=await Job.findById(req.params.id);
  if(!job) return res.status(404).json({message:'Job not found'});
  if(job.createdBy.toString()!==(req.user.companyId || req.user._id).toString()) {
    return res.status(403).json({message:'Not authorized to update this job'});
  }

  job.status=job.status==='closed' ? 'active' : 'closed';
  await job.save();
  await createAuditLog(req,{
    action:'job.status_toggled',
    entityType:'job',
    entityId:job._id,
    jobId:job._id,
    metadata:{ status:job.status }
  });

  res.json(job);
};

const reportJob=async (req,res)=>{
  const {reason,details='', category='other'}=req.body;
  if(!reason) return res.status(400).json({message:'Report reason is required'});

  const job=await Job.findById(req.params.id);
  if(!job) return res.status(404).json({message:'Job not found'});
  const priority = /scam|fraud|payment|money|fee/i.test(`${reason} ${details}`) ? 'high' : 'medium';

  const report=await Report.create({
    job:req.params.id,
    reportedBy:req.user._id,
    reason,
    details,
    category,
    priority
  });
  job.moderation = {
    ...(job.moderation || {}),
    isFlagged: true,
    suspiciousScore: Math.max(Number(job.moderation?.suspiciousScore || 0), priority === 'high' ? 5 : 3),
    reasons: Array.from(new Set([...(job.moderation?.reasons || []), `Reported by user: ${reason}`])),
    reviewStatus: 'reviewing',
    lastFlaggedAt: new Date()
  };
  await job.save();
  await User.findByIdAndUpdate(job.createdBy, {
    $inc: { 'trustFlags.reportCount': 1 },
    $set: { 'trustFlags.lastFlaggedAt': new Date() }
  });

  res.status(201).json({message:'Job reported',report});
};

const scheduleInterview = async (req, res) => {
  try {
    const { jobId, applicationId } = req.params;
    const { scheduledAt, duration, type, interviewer } = req.body;

    if (!scheduledAt) return res.status(400).json({ message: 'scheduledAt is required' });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const employerId = req.user.companyId || req.user._id;
    ensureEmployerOwnsJob(job, req.user);

    const application = job.applications.id(applicationId);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    application.interviews.push({
      scheduledAt: new Date(scheduledAt),
      duration: duration ? Number(duration) : 30,
      type: type || 'technical',
      interviewer: interviewer || req.user.name,
      location: req.body.location || '',
      meetingLink: req.body.meetingLink || '',
      status: 'scheduled'
    });

    application.stage = 'interviewing';
    application.status = 'shortlisted';
    application.stageHistory.push({
      stage: 'interviewing',
      updatedBy: req.user._id,
      updatedByName: req.user.name,
      updatedAt: new Date()
    });

    await job.save();
    await createAuditLog(req,{
      action:'application.interview_scheduled',
      entityType:'application',
      entityId:application._id,
      jobId:job._id,
      applicationId:application._id,
      targetUser:application.user,
      metadata:{ scheduledAt, type:type || 'technical' }
    });
    const applicant = await User.findById(application.user).select('name email');
    await sendInterviewUpdateSideEffects({
      action: 'scheduled',
      applicant,
      application,
      interview: application.interviews[application.interviews.length - 1],
      job,
      actorName: req.user.name
    });

    res.status(201).json({ message: 'Interview scheduled', application });
  } catch (error) {
    console.error('Error in scheduleInterview:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const addApplicationNote = async (req, res) => {
  try {
    const { jobId, applicationId } = req.params;
    const { note } = req.body;

    if (!note) return res.status(400).json({ message: 'Note content is required' });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const employerId = req.user.companyId || req.user._id;
    ensureEmployerOwnsJob(job, req.user);

    const application = job.applications.id(applicationId);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    application.notes.push({
      note,
      addedBy: req.user._id,
      addedByName: req.user.name,
      createdAt: new Date()
    });

    await job.save();
    await createAuditLog(req,{
      action:'application.note_added',
      entityType:'application',
      entityId:application._id,
      jobId:job._id,
      applicationId:application._id,
      targetUser:application.user,
      metadata:{ noteLength:note.length }
    });
    res.status(201).json({ message: 'Note added', application });
  } catch (error) {
    console.error('Error in addApplicationNote:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const updateApplicationStage = async (req, res) => {
  try {
    const { jobId, applicationId } = req.params;
    const { stage } = req.body;

    if (!ATS_STAGES.includes(stage)) {
      return res.status(400).json({ message: 'Invalid pipeline stage' });
    }

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const employerId = req.user.companyId || req.user._id;
    ensureEmployerOwnsJob(job, req.user);

    const application = job.applications.id(applicationId);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    application.stage = stage;
    application.status = deriveStatusFromStage(stage);
    application.archived = false;
    application.archivedAt = undefined;

    application.stageHistory.push({
      stage,
      updatedBy: req.user._id,
      updatedByName: req.user.name,
      updatedAt: new Date()
    });

    await job.save();
    await createAuditLog(req,{
      action:'application.stage_updated',
      entityType:'application',
      entityId:application._id,
      jobId:job._id,
      applicationId:application._id,
      targetUser:application.user,
      metadata:{ stage, status:application.status }
    });

    await Notification.create({
      user: application.user,
      type: 'status',
      message: `Your application status for ${job.title} has been moved to ${stage}`
    });

    res.json({ message: 'Application stage updated', application });
  } catch (error) {
    console.error('Error in updateApplicationStage:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const updateInterview = async (req, res) => {
  try {
    const { jobId, applicationId, interviewId } = req.params;
    const { status, feedback, scheduledAt, duration, interviewer, location, meetingLink } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    ensureEmployerOwnsJob(job, req.user);

    const application = job.applications.id(applicationId);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    const interview = application.interviews.id(interviewId);
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    const originalScheduledAt = interview.scheduledAt ? new Date(interview.scheduledAt) : null;
    const originalStatus = interview.status;
    const originalDuration = interview.duration;
    const originalMeetingLink = interview.meetingLink;
    const originalLocation = interview.location;

    if (scheduledAt !== undefined) interview.scheduledAt = new Date(scheduledAt);
    if (duration !== undefined) interview.duration = Number(duration);
    if (interviewer !== undefined) interview.interviewer = interviewer;
    if (location !== undefined) interview.location = location;
    if (meetingLink !== undefined) interview.meetingLink = meetingLink;
    if (feedback !== undefined) interview.feedback = feedback;
    if (status !== undefined) interview.status = status;
    if (status === 'completed') interview.completedAt = new Date();

    await job.save();
    await createAuditLog(req,{
      action:'application.interview_updated',
      entityType:'application',
      entityId:application._id,
      jobId:job._id,
      applicationId:application._id,
      targetUser:application.user,
      metadata:{ interviewId, status:status || interview.status }
    });
    const schedulingChanged = (
      (scheduledAt !== undefined && String(originalScheduledAt) !== String(interview.scheduledAt))
      || (duration !== undefined && Number(originalDuration) !== Number(interview.duration))
      || (meetingLink !== undefined && String(originalMeetingLink || '') !== String(interview.meetingLink || ''))
      || (location !== undefined && String(originalLocation || '') !== String(interview.location || ''))
    );
    const applicant = await User.findById(application.user).select('name email');
    if (interview.status === 'cancelled' && originalStatus !== 'cancelled') {
      await sendInterviewUpdateSideEffects({
        action: 'cancelled',
        applicant,
        application,
        interview,
        job,
        actorName: req.user.name
      });
    } else if (schedulingChanged || (originalStatus === 'cancelled' && interview.status === 'scheduled')) {
      await sendInterviewUpdateSideEffects({
        action: 'rescheduled',
        applicant,
        application,
        interview,
        job,
        actorName: req.user.name
      });
    }

    res.json({ message: 'Interview updated', interview, application });
  } catch (error) {
    console.error('Error in updateInterview:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server Error' });
  }
};

const downloadInterviewInvite = async (req, res) => {
  try {
    const { jobId, applicationId, interviewId } = req.params;
    const job = await Job.findById(jobId).populate('createdBy', 'name companyName');
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const application = job.applications.id(applicationId);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    const employerId = req.user.companyId || req.user._id;
    const isEmployer = job.createdBy._id.toString() === employerId.toString();
    const isApplicant = application.user.toString() === req.user._id.toString();
    if (!isEmployer && !isApplicant) {
      return res.status(403).json({ message: 'Not authorized to download this interview invite' });
    }

    const interview = application.interviews.id(interviewId);
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    const ics = buildInterviewIcs({
      jobTitle: job.title,
      companyName: job.createdBy?.companyName || job.createdBy?.name || '',
      candidateName: application.candidateSnapshot?.name || req.user.name,
      interview,
      inviteUrl: `${getApiBaseUrl()}${buildInterviewInviteUrl({ jobId, applicationId, interviewId })}`,
      applicationUrl: buildApplicationTrackerUrl(jobId)
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="interview-${jobId}-${interviewId}.ics"`);
    res.send(ics);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to download interview invite' });
  }
};

const getApplicationTimeline = async (req, res) => {
  try {
    const { jobId, applicationId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const employerId = req.user.companyId || req.user._id;
    const isEmployer = job.createdBy.toString() === employerId.toString();
    const application = job.applications.id(applicationId);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    const isApplicant = application.user.toString() === req.user._id.toString();
    if (!isEmployer && !isApplicant) {
      return res.status(403).json({ message: 'Not authorized to view this application timeline' });
    }

    const timeline = [];

    // 1. Applied event
    timeline.push({
      type: 'applied',
      title: 'Application Submitted',
      description: 'Candidate submitted their application.',
      timestamp: application.appliedAt
    });

    // 2. Stage History events
    application.stageHistory.forEach(hist => {
      timeline.push({
        type: 'stage_change',
        title: `Moved to ${hist.stage.toUpperCase()}`,
        description: `Status updated by ${hist.updatedByName || 'Employer'}`,
        timestamp: hist.updatedAt
      });
    });

    // 3. Interviews
    application.interviews.forEach(interview => {
      timeline.push({
        type: 'interview',
        title: `Interview Scheduled (${interview.type})`,
        description: `Scheduled with ${interview.interviewer || 'Interviewer'} on ${new Date(interview.scheduledAt).toLocaleString()}. Status: ${interview.status}`,
        timestamp: interview.scheduledAt
      });
    });

    // 4. Notes (Only visible to employer team)
    if (isEmployer) {
      application.notes.forEach(note => {
        timeline.push({
          type: 'note',
          title: `Interviewer Note by ${note.addedByName}`,
          description: note.note,
          timestamp: note.createdAt
        });
      });
    }

    // Sort chronologically
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json(timeline);
  } catch (error) {
    console.error('Error in getApplicationTimeline:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const featureJob = async (req, res) => {
  try {
    const durationDays = Math.max(Number(req.body.durationDays || 30), 1);
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    ensureEmployerOwnsJob(job, req.user);

    const now = new Date();
    job.isFeatured = true;
    job.featuredActivatedAt = now;
    job.featuredUntil = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    job.featuredAnalytics = {
      impressions: 0,
      clicks: 0,
      lastFeaturedAt: now
    };
    await job.save();
    await createAuditLog(req,{
      action:'job.featured',
      entityType:'job',
      entityId:job._id,
      jobId:job._id,
      metadata:{ durationDays }
    });

    res.json({
      message: 'Job featured successfully',
      featuredUntil: job.featuredUntil,
      analytics: job.featuredAnalytics
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to feature job' });
  }
};

const trackJobClick = async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ message: 'Job not found' });

  job.clicks = Number(job.clicks || 0) + 1;
  if (isFeaturedActive(job)) {
    job.featuredAnalytics = {
      ...(job.featuredAnalytics || {}),
      impressions: Number(job.featuredAnalytics?.impressions || 0),
      clicks: Number(job.featuredAnalytics?.clicks || 0) + 1,
      lastFeaturedAt: job.featuredAnalytics?.lastFeaturedAt || job.featuredActivatedAt || new Date()
    };
  }
  await job.save();

  res.json({ clicks: job.clicks, featuredAnalytics: job.featuredAnalytics || {} });
};

const getJobAnalytics = async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  ensureEmployerOwnsJob(job, req.user);

  res.json({
    jobId: job._id,
    title: job.title,
    views: job.views || 0,
    clicks: job.clicks || 0,
    applicationCount: job.applicationCount || 0,
    atsSummary: buildAtsSummary(job.applications.map(mapApplicationForEmployer)),
    isFeaturedActive: isFeaturedActive(job),
    featuredUntil: job.featuredUntil || null,
    featuredAnalytics: job.featuredAnalytics || {}
  });
};

module.exports={
    createJob,
    getAllJobs,
    getJobById,
    updateJob,
    deleteJob,
    applyToJob,
    getMyApplications,
    getMyApplicantsForEmployerByJobs,
    bulkUpdateApplications,
    exportApplicantsCsv,
    updateApplicationStatus,
    toggleJobStatus,
    reportJob,
    scheduleInterview,
    updateInterview,
    downloadInterviewInvite,
    addApplicationNote,
    updateApplicationStage,
    getApplicationTimeline,
    featureJob,
    trackJobClick,
    getJobAnalytics
};
