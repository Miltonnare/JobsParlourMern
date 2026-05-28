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
    getMyResumes,
    setPrimaryResume,
    deleteResume,
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
    getAdminModerationQueue,
    updateEmployerVerification,
    reviewFlaggedJob,
    getEmployerAuditLogs,
    getAdminAuditLogs,
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
const { requireEmployerCapability } = require('../middleware/capabilityMiddleware');
const {
    validate,
    stringField,
    emailField,
    numberField,
    booleanField,
    arrayField,
    objectField,
    idField
} = require('../middleware/validationMiddleware');
const {
    uploadResume: resumeUploadMiddleware,
    uploadImage: imageUploadMiddleware,
    uploadAnyFile: anyFileUploadMiddleware
} = require('../middleware/uploadMiddleware');
const router=express.Router();

router.post('/register',validate({
    body:[
        stringField('name',{required:true,minLength:2,maxLength:100}),
        emailField('email',{required:true}),
        stringField('password',{required:true,minLength:6,maxLength:120}),
        stringField('role',{required:true,enum:['admin','employer','jobseeker']}),
        stringField('companyName',{maxLength:120})
    ]
}),registerUser);

router.post('/login',validate({
    body:[
        emailField('email',{required:true}),
        stringField('password',{required:true,minLength:6,maxLength:120})
    ]
}),loginUser)
router.get('/verify-email',validate({
    query:[stringField('token',{required:true,minLength:10})]
}),verifyEmail);

router.get('/me',protect,getCurrentUser);
router.post('/resend-verification',protect,resendVerificationEmail);
router.put('/profile',protect,validate({
    body:[
        stringField('name',{minLength:2,maxLength:100}),
        stringField('companyName',{maxLength:120}),
        stringField('companyWebsite',{maxLength:255}),
        stringField('companyLogo',{maxLength:500}),
        stringField('profileImage',{maxLength:500}),
        stringField('industry',{maxLength:120}),
        stringField('companyDescription',{maxLength:2000}),
        stringField('bio',{maxLength:2000}),
        arrayField('skills'),
        stringField('education',{maxLength:2000}),
        stringField('experience',{maxLength:4000}),
        stringField('resumeUrl',{maxLength:500}),
        stringField('resumeText',{maxLength:15000}),
        numberField('expectedRate',{min:0}),
        stringField('availability',{maxLength:200})
    ]
}),updateProfile);
router.get('/onboarding',protect,getOnboarding);
router.put('/onboarding',protect,validate({
    body:[
        stringField('currentStep',{maxLength:100}),
        arrayField('completedSteps'),
        objectField('answers'),
        booleanField('completed')
    ]
}),updateOnboarding);
router.get('/personalization',protect,getPersonalization);
router.put('/personalization',protect,validate({
    body:[
        arrayField('targetRoles'),
        arrayField('preferredLocations'),
        arrayField('preferredJobTypes'),
        arrayField('preferredWorkplaces'),
        arrayField('preferredIndustries'),
        numberField('salaryMin',{min:0}),
        numberField('salaryMax',{min:0}),
        booleanField('openToBids'),
        stringField('bidCurrency',{maxLength:10}),
        arrayField('skillsToImprove'),
        arrayField('hiringGoals'),
        stringField('companySize',{maxLength:100}),
        arrayField('preferredCandidateSkills'),
        numberField('hiringBudgetMin',{min:0}),
        numberField('hiringBudgetMax',{min:0}),
        stringField('jobPostFrequency',{maxLength:100}),
        stringField('applicantSortPreference',{enum:['newest','ats-high','bid-low','bid-high']}),
        objectField('notificationPreferences'),
        stringField('locale',{maxLength:20}),
        stringField('timezone',{maxLength:100})
    ]
}),updatePersonalization);
router.post('/resume',protect,restrictTo('jobseeker'),resumeUploadMiddleware.single('resume'),uploadResume);
router.get('/resumes',protect,restrictTo('jobseeker'),getMyResumes);
router.patch('/resumes/:resumeId/primary',protect,restrictTo('jobseeker'),validate({
    params:[idField('resumeId',{required:true,label:'resume id'})]
}),setPrimaryResume);
router.delete('/resumes/:resumeId',protect,restrictTo('jobseeker'),validate({
    params:[idField('resumeId',{required:true,label:'resume id'})]
}),deleteResume);
router.post('/resume/parse',protect,restrictTo('jobseeker'),validate({
    body:[stringField('resumeText',{maxLength:15000})]
}),parseResumeAndScoreProfile);
router.post('/upload/image',protect,imageUploadMiddleware.single('image'),uploadProfileImage);
router.post('/upload/file',protect,anyFileUploadMiddleware.single('file'),uploadGenericFile);
router.post('/profile/boost',protect,restrictTo('jobseeker'),validate({
    body:[numberField('durationDays',{min:1,max:365})]
}),enforcePlanLimit('boost_profile'),boostProfile);
router.get('/saved-jobs',protect,restrictTo('jobseeker'),getSavedJobs);
router.post('/saved-jobs/:jobId',protect,restrictTo('jobseeker'),validate({
    params:[idField('jobId',{required:true})]
}),toggleSavedJob);
router.get('/notifications',protect,getNotifications);
router.put('/notifications/read',protect,markNotificationsRead);
router.get('/audit-logs',protect,restrictTo('employer'),requireEmployerCapability('audit.view'),getEmployerAuditLogs);
router.get('/admin/stats',protect,restrictTo('admin'),getAdminStats);
router.get('/admin/users',protect,restrictTo('admin'),getAdminUsers);
router.get('/admin/audit-logs',protect,restrictTo('admin'),getAdminAuditLogs);
router.put('/admin/users/:id',protect,restrictTo('admin'),validate({
    params:[idField('id',{required:true,label:'user id'})],
    body:[
        stringField('name',{minLength:2,maxLength:100}),
        stringField('companyName',{maxLength:120}),
        stringField('role',{enum:['admin','employer','jobseeker']})
    ]
}),updateAdminUser);
router.delete('/admin/users/:id',protect,restrictTo('admin'),validate({
    params:[idField('id',{required:true,label:'user id'})]
}),deleteAdminUser);
router.get('/admin/jobs',protect,restrictTo('admin'),getAdminJobs);
router.delete('/admin/jobs/:id',protect,restrictTo('admin'),validate({
    params:[idField('id',{required:true,label:'job id'})]
}),deleteAdminJob);
router.get('/admin/reports',protect,restrictTo('admin'),getAdminReports);
router.patch('/admin/reports/:id',protect,restrictTo('admin'),validate({
    params:[idField('id',{required:true,label:'report id'})],
    body:[
        stringField('status',{required:true,enum:['open','reviewing','resolved','dismissed']}),
        stringField('adminNotes',{maxLength:5000})
    ]
}),updateAdminReport);
router.get('/admin/moderation',protect,restrictTo('admin'),getAdminModerationQueue);
router.patch('/admin/employers/:id/verification',protect,restrictTo('admin'),validate({
    params:[idField('id',{required:true,label:'employer id'})],
    body:[
        stringField('status',{required:true,enum:['unverified','pending','verified','rejected']}),
        stringField('notes',{maxLength:5000})
    ]
}),updateEmployerVerification);
router.patch('/admin/jobs/:id/moderation',protect,restrictTo('admin'),validate({
    params:[idField('id',{required:true,label:'job id'})],
    body:[
        stringField('reviewStatus',{required:true,enum:['none','reviewing','cleared','actioned']}),
        stringField('reviewerNotes',{maxLength:5000}),
        stringField('status',{enum:['active','closed','draft']})
    ]
}),reviewFlaggedJob);

router.post('/team',protect,restrictTo('employer'),requireEmployerCapability('team.manage'),validate({
    body:[
        stringField('name',{required:true,minLength:2,maxLength:100}),
        emailField('email',{required:true}),
        stringField('password',{required:true,minLength:6,maxLength:120}),
        stringField('employerRole',{required:true,enum:['recruiter','hiring_manager']})
    ]
}),addTeamMember);
router.get('/team',protect,restrictTo('employer'),requireEmployerCapability('team.view'),getTeamMembers);
router.patch('/team/:id/role',protect,restrictTo('employer'),requireEmployerCapability('team.manage'),validate({
    params:[idField('id',{required:true,label:'team member id'})],
    body:[stringField('employerRole',{required:true,enum:['recruiter','hiring_manager']})]
}),updateTeamMemberRole);
router.delete('/team/:id',protect,restrictTo('employer'),requireEmployerCapability('team.manage'),validate({
    params:[idField('id',{required:true,label:'team member id'})]
}),removeTeamMember);

module.exports=router;
