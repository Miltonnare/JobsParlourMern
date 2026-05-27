
const Job = require('../models/jobModel');
const User = require('../models/userModel');
const Notification = require('../models/notificationModel');
const Report = require('../models/reportModel');
const { bumpUsageValue } = require('../middleware/subscriptionMiddleware');
const { buildResumeRecordFromUpload } = require('../utils/resumeLibrary');

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

const isFeaturedActive = (job) => Boolean(job.isFeatured && job.featuredUntil && new Date(job.featuredUntil) > new Date());

const createJob=async (req,res)=>{
    const {title,description,location,jobType,Type,salary,workplace,status}=req.body;

    if(!title||!location){
        return res.status(400).json({message:"Title and Location are mandatory"});
    }

    const newJob=await Job.create({
        title,
        description,
        location,
        jobType:jobType || Type || 'full-time',
        salary,
        workplace:workplace || 'onsite',
        status:status || 'active',
        createdBy:req.user.companyId || req.user._id


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

    const updated=await Job.findByIdAndUpdate(req.params.id,
        payload,        
      { new: true } 
    );

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

    // Find jobs created by this employer, and populate applications.user
    const jobs = await Job.find({ createdBy: employerId })
      .populate('applications.user', 'name email');

    // Format the response
    const formatApplication=(app)=>({
        _id: app._id,
        applicantId: app.user, // already populated with name/email
        appliedAt: app.appliedAt,
        status: app.status,
        note: app.note,
        resumeUrl: app.resumeUrl,
        bid: app.bid || {},
        ats: app.ats || {},
        candidateSnapshot: app.candidateSnapshot || {}
      });

    const jobsWithApplicants = jobs.map(job => {
      const applications=job.applications.map(formatApplication);
      const grouped=applications.reduce((acc,app)=>{
        const status=app.status || 'pending';
        acc[status]=acc[status] || [];
        acc[status].push(app);
        return acc;
      },{pending:[],shortlisted:[],rejected:[],hired:[]});

      return {
        jobId: job._id,
        title: job.title,
        status: job.status,
        applications,
        pipeline: grouped
      };
    });

    res.json(jobsWithApplicants);
  } catch (err) {
    console.error('Error in getMyApplicantsForEmployerByJobs:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
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
  res.send(csv);
};

const updateApplicationStatus=async (req,res)=>{
  const {jobId,applicationId}=req.params;
  const {status}=req.body;
  const allowed=['pending','shortlisted','rejected','hired'];
  if(!allowed.includes(status)) return res.status(400).json({message:'Invalid application status'});

  const job=await Job.findById(jobId);
  if(!job) return res.status(404).json({message:'Job not found'});
  if(job.createdBy.toString()!==(req.user.companyId || req.user._id).toString()) {
    return res.status(403).json({message:'Not authorized to update this application'});
  }

  const application=job.applications.id(applicationId);
  if(!application) return res.status(404).json({message:'Application not found'});

  application.status=status;
  await job.save();

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

  res.json(job);
};

const reportJob=async (req,res)=>{
  const {reason,details=''}=req.body;
  if(!reason) return res.status(400).json({message:'Report reason is required'});

  const job=await Job.findById(req.params.id);
  if(!job) return res.status(404).json({message:'Job not found'});

  const report=await Report.create({
    job:req.params.id,
    reportedBy:req.user._id,
    reason,
    details
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

    await Notification.create({
      user: application.user,
      type: 'system',
      message: `An interview has been scheduled for ${job.title} on ${new Date(scheduledAt).toLocaleString()}`
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

    const allowedStages = ['applied', 'screening', 'interviewing', 'offered', 'hired', 'rejected'];
    if (!allowedStages.includes(stage)) {
      return res.status(400).json({ message: 'Invalid pipeline stage' });
    }

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const employerId = req.user.companyId || req.user._id;
    ensureEmployerOwnsJob(job, req.user);

    const application = job.applications.id(applicationId);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    application.stage = stage;
    
    // Sync application status
    if (stage === 'rejected') {
      application.status = 'rejected';
    } else if (stage === 'hired') {
      application.status = 'hired';
    } else if (['screening', 'interviewing', 'offered'].includes(stage)) {
      application.status = 'shortlisted';
    } else {
      application.status = 'pending';
    }

    application.stageHistory.push({
      stage,
      updatedBy: req.user._id,
      updatedByName: req.user.name,
      updatedAt: new Date()
    });

    await job.save();

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

    if (scheduledAt !== undefined) interview.scheduledAt = new Date(scheduledAt);
    if (duration !== undefined) interview.duration = Number(duration);
    if (interviewer !== undefined) interview.interviewer = interviewer;
    if (location !== undefined) interview.location = location;
    if (meetingLink !== undefined) interview.meetingLink = meetingLink;
    if (feedback !== undefined) interview.feedback = feedback;
    if (status !== undefined) interview.status = status;
    if (status === 'completed') interview.completedAt = new Date();

    await job.save();

    res.json({ message: 'Interview updated', interview, application });
  } catch (error) {
    console.error('Error in updateInterview:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server Error' });
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
    exportApplicantsCsv,
    updateApplicationStatus,
    toggleJobStatus,
    reportJob,
    scheduleInterview,
    updateInterview,
    addApplicationNote,
    updateApplicationStage,
    getApplicationTimeline,
    featureJob,
    trackJobClick,
    getJobAnalytics
};
