const express=require('express');

const router=express.Router();

const {createJob,getAllJobs,getJobById,updateJob,deleteJob,applyToJob,getMyApplications, getMyApplicantsForEmployerByJobs, exportApplicantsCsv, updateApplicationStatus, toggleJobStatus, reportJob} =require('../controllers/jobController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');

router.get('/',getAllJobs);
router.get('/my-applications', protect, restrictTo('jobseeker'), getMyApplications);
router.get('/applicants', protect, restrictTo('employer'), getMyApplicantsForEmployerByJobs);
router.get('/applicants/export', protect, restrictTo('employer'), exportApplicantsCsv);
router.post('/create', protect, restrictTo('employer'),createJob);

router.get('/:id',getJobById);
router.put('/:id',protect,restrictTo('employer'),updateJob);
router.delete('/:id',protect,restrictTo('employer'),deleteJob);
router.patch('/:id/status',protect,restrictTo('employer'),toggleJobStatus);
router.patch('/:jobId/applications/:applicationId/status',protect,restrictTo('employer'),updateApplicationStatus);



router.post('/:id/apply', protect, restrictTo('jobseeker'), applyToJob);
router.post('/:id/report', protect, reportJob);


module.exports=router;
