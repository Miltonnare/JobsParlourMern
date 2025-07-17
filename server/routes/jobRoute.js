const express=require('express');

const router=express.Router();

const {createJob,getAllJobs,getJobById,updateJob,deleteJob,applyToJob,getMyApplications, getMyApplicantsForEmployerByJobs} =require('../controllers/jobController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');

//

router.get('/',getAllJobs);
router.get('/my-applications', protect, restrictTo('jobseeker'), getMyApplications);
router.get('/applicants', protect, restrictTo('employer'), getMyApplicantsForEmployerByJobs);
router.post('/create', protect, restrictTo('employer'),createJob);

router.get('/:id',getJobById);
router.put('/:id',protect,restrictTo('employer'),updateJob);
router.delete('/:id',protect,restrictTo('employer'),deleteJob);



router.post('/:id/apply', protect, restrictTo('jobseeker'), applyToJob);


module.exports=router;