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

router.get('/',getAllJobs);
router.get('/my-applications', protect, restrictTo('jobseeker'), getMyApplications);
router.get('/applicants', protect, restrictTo('employer'), getMyApplicantsForEmployerByJobs);
router.get('/applicants/export', protect, restrictTo('employer'), enforcePlanLimit('export_applicants'), exportApplicantsCsv);
router.post('/create', protect, restrictTo('employer'), enforcePlanLimit('post_job'), createJob);

router.get('/:id',getJobById);
router.get('/:id/analytics', protect, restrictTo('employer'), getJobAnalytics);
router.post('/:id/click', trackJobClick);
router.post('/:id/feature', protect, restrictTo('employer'), enforcePlanLimit('feature_job'), featureJob);
router.put('/:id',protect,restrictTo('employer'),updateJob);
router.delete('/:id',protect,restrictTo('employer'),deleteJob);
router.patch('/:id/status',protect,restrictTo('employer'),toggleJobStatus);
router.patch('/:jobId/applications/:applicationId/status',protect,restrictTo('employer'),updateApplicationStatus);



router.post('/:id/apply', protect, restrictTo('jobseeker'), enforcePlanLimit('apply_job'), applyToJob);
router.post('/:id/report', protect, reportJob);

// Interview Pipeline Routes
router.post('/:jobId/applications/:applicationId/interviews', protect, restrictTo('employer'), scheduleInterview);
router.patch('/:jobId/applications/:applicationId/interviews/:interviewId', protect, restrictTo('employer'), updateInterview);
router.post('/:jobId/applications/:applicationId/notes', protect, restrictTo('employer'), addApplicationNote);
router.put('/:jobId/applications/:applicationId/stage', protect, restrictTo('employer'), updateApplicationStage);
router.get('/:jobId/applications/:applicationId/timeline', protect, getApplicationTimeline);

module.exports=router;
