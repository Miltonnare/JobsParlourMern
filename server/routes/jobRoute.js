const express=require('express');

const router=express.Router();

const {
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
} =require('../controllers/jobController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');
const { enforcePlanLimit } = require('../middleware/subscriptionMiddleware');
const { requireEmployerCapability } = require('../middleware/capabilityMiddleware');
const {
  validate,
  stringField,
  numberField,
  idField
} = require('../middleware/validationMiddleware');
const { uploadResume: resumeUploadMiddleware } = require('../middleware/uploadMiddleware');

router.get('/',getAllJobs);
router.get('/my-applications', protect, restrictTo('jobseeker'), getMyApplications);
router.get('/applicants', protect, restrictTo('employer'), requireEmployerCapability('applications.review'), getMyApplicantsForEmployerByJobs);
router.get('/applicants/export', protect, restrictTo('employer'), requireEmployerCapability('jobs.exportApplicants'), enforcePlanLimit('export_applicants'), exportApplicantsCsv);
router.post('/create', protect, restrictTo('employer'), requireEmployerCapability('jobs.create'), validate({
  body:[
    stringField('title',{required:true,minLength:2,maxLength:150}),
    stringField('description',{required:true,minLength:10,maxLength:10000}),
    stringField('location',{required:true,minLength:2,maxLength:150}),
    stringField('jobType',{enum:['full-time','part-time','internship','contract','freelance']}),
    stringField('Type',{enum:['full-time','part-time','internship','contract','freelance']}),
    numberField('salary',{min:0}),
    stringField('workplace',{enum:['onsite','remote','hybrid']}),
    stringField('status',{enum:['active','closed','draft']})
  ]
}), enforcePlanLimit('post_job'), createJob);

router.get('/:id',validate({ params:[idField('id',{required:true,label:'job id'})] }),getJobById);
router.get('/:id/analytics', protect, restrictTo('employer'), requireEmployerCapability('analytics.view'), validate({
  params:[idField('id',{required:true,label:'job id'})]
}), getJobAnalytics);
router.post('/:id/click', validate({ params:[idField('id',{required:true,label:'job id'})] }), trackJobClick);
router.post('/:id/feature', protect, restrictTo('employer'), requireEmployerCapability('jobs.feature'), validate({
  params:[idField('id',{required:true,label:'job id'})],
  body:[numberField('durationDays',{min:1,max:365})]
}), enforcePlanLimit('feature_job'), featureJob);
router.put('/:id',protect,restrictTo('employer'),requireEmployerCapability('jobs.update'),validate({
  params:[idField('id',{required:true,label:'job id'})],
  body:[
    stringField('title',{minLength:2,maxLength:150}),
    stringField('description',{minLength:10,maxLength:10000}),
    stringField('location',{minLength:2,maxLength:150}),
    stringField('jobType',{enum:['full-time','part-time','internship','contract','freelance']}),
    stringField('Type',{enum:['full-time','part-time','internship','contract','freelance']}),
    numberField('salary',{min:0}),
    stringField('workplace',{enum:['onsite','remote','hybrid']}),
    stringField('status',{enum:['active','closed','draft']})
  ]
}),updateJob);
router.delete('/:id',protect,restrictTo('employer'),requireEmployerCapability('jobs.delete'),validate({
  params:[idField('id',{required:true,label:'job id'})]
}),deleteJob);
router.patch('/:id/status',protect,restrictTo('employer'),requireEmployerCapability('jobs.update'),validate({
  params:[idField('id',{required:true,label:'job id'})]
}),toggleJobStatus);
router.patch('/:jobId/applications/:applicationId/status',protect,restrictTo('employer'),requireEmployerCapability('applications.advance'),validate({
  params:[
    idField('jobId',{required:true,label:'job id'}),
    idField('applicationId',{required:true,label:'application id'})
  ],
  body:[stringField('status',{required:true,enum:['pending','shortlisted','rejected','hired']})]
}),updateApplicationStatus);



router.post('/:id/apply', protect, restrictTo('jobseeker'), resumeUploadMiddleware.single('resume'), validate({
  params:[idField('id',{required:true,label:'job id'})],
  body:[
    stringField('note',{maxLength:3000}),
    idField('profileResumeId',{label:'profile resume id'}),
    stringField('resumeUrl',{maxLength:500}),
    stringField('resumeText',{maxLength:15000}),
    numberField('bidAmount',{min:0}),
    stringField('bidCurrency',{maxLength:10}),
    stringField('bidType',{enum:['fixed','hourly','monthly']}),
    stringField('estimatedDuration',{maxLength:120}),
    stringField('availability',{maxLength:120})
  ]
}), enforcePlanLimit('apply_job'), applyToJob);
router.post('/:id/report', protect, validate({
  params:[idField('id',{required:true,label:'job id'})],
  body:[
    stringField('reason',{required:true,minLength:3,maxLength:500}),
    stringField('details',{maxLength:3000})
  ]
}), reportJob);

// Interview Pipeline Routes
router.post('/:jobId/applications/:applicationId/interviews', protect, restrictTo('employer'), requireEmployerCapability('applications.interviews'), validate({
  params:[
    idField('jobId',{required:true,label:'job id'}),
    idField('applicationId',{required:true,label:'application id'})
  ],
  body:[
    stringField('scheduledAt',{required:true}),
    numberField('duration',{min:1,max:480}),
    stringField('type',{enum:['technical','hr','behavioral','other']}),
    stringField('interviewer',{maxLength:120}),
    stringField('location',{maxLength:255}),
    stringField('meetingLink',{maxLength:500})
  ]
}), scheduleInterview);
router.patch('/:jobId/applications/:applicationId/interviews/:interviewId', protect, restrictTo('employer'), requireEmployerCapability('applications.interviews'), validate({
  params:[
    idField('jobId',{required:true,label:'job id'}),
    idField('applicationId',{required:true,label:'application id'}),
    idField('interviewId',{required:true,label:'interview id'})
  ],
  body:[
    stringField('status',{enum:['scheduled','completed','cancelled']}),
    stringField('feedback',{maxLength:5000}),
    stringField('scheduledAt'),
    numberField('duration',{min:1,max:480}),
    stringField('interviewer',{maxLength:120}),
    stringField('location',{maxLength:255}),
    stringField('meetingLink',{maxLength:500})
  ]
}), updateInterview);
router.post('/:jobId/applications/:applicationId/notes', protect, restrictTo('employer'), requireEmployerCapability('applications.notes'), validate({
  params:[
    idField('jobId',{required:true,label:'job id'}),
    idField('applicationId',{required:true,label:'application id'})
  ],
  body:[stringField('note',{required:true,minLength:1,maxLength:5000})]
}), addApplicationNote);
router.put('/:jobId/applications/:applicationId/stage', protect, restrictTo('employer'), requireEmployerCapability('applications.advance'), validate({
  params:[
    idField('jobId',{required:true,label:'job id'}),
    idField('applicationId',{required:true,label:'application id'})
  ],
  body:[stringField('stage',{required:true,enum:['applied','screening','interviewing','offered','hired','rejected']})]
}), updateApplicationStage);
router.get('/:jobId/applications/:applicationId/timeline', protect, validate({
  params:[
    idField('jobId',{required:true,label:'job id'}),
    idField('applicationId',{required:true,label:'application id'})
  ]
}), getApplicationTimeline);

module.exports=router;
