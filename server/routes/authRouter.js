const express=require('express');

const {
    registerUser,
    loginUser,
    verifyEmail,
    resendVerificationEmail,
    getCurrentUser,
    updateProfile,
    uploadResume,
    uploadProfileImage,
    uploadGenericFile,
    getOnboarding,
    updateOnboarding,
    getPersonalization,
    updatePersonalization,
    getSavedJobs,
    toggleSavedJob,
    getNotifications,
    markNotificationsRead,
    getAdminStats,
    getAdminUsers,
    getAdminJobs,
    updateAdminUser,
    deleteAdminUser,
    deleteAdminJob,
    getAdminReports,
    updateAdminReport,
    addTeamMember,
    getTeamMembers,
    removeTeamMember,
    updateTeamMemberRole,
    parseResumeAndScoreProfile,
    boostProfile
}=require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');
const { enforcePlanLimit } = require('../middleware/subscriptionMiddleware');
const {
    uploadResume: resumeUploadMiddleware,
    uploadImage: imageUploadMiddleware,
    uploadAnyFile: anyFileUploadMiddleware
} = require('../middleware/uploadMiddleware');
const router=express.Router();

router.post('/register',registerUser);

router.post('/login',loginUser)
router.get('/verify-email',verifyEmail);

router.get('/me',protect,getCurrentUser);
router.post('/resend-verification',protect,resendVerificationEmail);
router.put('/profile',protect,updateProfile);
router.get('/onboarding',protect,getOnboarding);
router.put('/onboarding',protect,updateOnboarding);
router.get('/personalization',protect,getPersonalization);
router.put('/personalization',protect,updatePersonalization);
router.post('/resume',protect,restrictTo('jobseeker'),resumeUploadMiddleware.single('resume'),uploadResume);
router.post('/resume/parse',protect,restrictTo('jobseeker'),parseResumeAndScoreProfile);
router.post('/upload/image',protect,imageUploadMiddleware.single('image'),uploadProfileImage);
router.post('/upload/file',protect,anyFileUploadMiddleware.single('file'),uploadGenericFile);
router.post('/profile/boost',protect,restrictTo('jobseeker'),enforcePlanLimit('boost_profile'),boostProfile);
router.get('/saved-jobs',protect,restrictTo('jobseeker'),getSavedJobs);
router.post('/saved-jobs/:jobId',protect,restrictTo('jobseeker'),toggleSavedJob);
router.get('/notifications',protect,getNotifications);
router.put('/notifications/read',protect,markNotificationsRead);
router.get('/admin/stats',protect,restrictTo('admin'),getAdminStats);
router.get('/admin/users',protect,restrictTo('admin'),getAdminUsers);
router.put('/admin/users/:id',protect,restrictTo('admin'),updateAdminUser);
router.delete('/admin/users/:id',protect,restrictTo('admin'),deleteAdminUser);
router.get('/admin/jobs',protect,restrictTo('admin'),getAdminJobs);
router.delete('/admin/jobs/:id',protect,restrictTo('admin'),deleteAdminJob);
router.get('/admin/reports',protect,restrictTo('admin'),getAdminReports);
router.patch('/admin/reports/:id',protect,restrictTo('admin'),updateAdminReport);

router.post('/team',protect,restrictTo('employer'),addTeamMember);
router.get('/team',protect,restrictTo('employer'),getTeamMembers);
router.patch('/team/:id/role',protect,restrictTo('employer'),updateTeamMemberRole);
router.delete('/team/:id',protect,restrictTo('employer'),removeTeamMember);

module.exports=router;
