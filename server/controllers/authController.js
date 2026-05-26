const user=require('../models/userModel');
const Job=require('../models/jobModel');
const Notification=require('../models/notificationModel');
const Report=require('../models/reportModel');
const Subscription=require('../models/subscriptionModel');
const bycrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const crypto=require('crypto');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');
const { sendEmailVerification } = require('../utils/mailer');

const ensureUserSetupObjects=(currentUser)=>{
    currentUser.onboarding=currentUser.onboarding || {
        completed:false,
        currentStep:'profile',
        completedSteps:[],
        answers:{}
    };
    currentUser.personalization=currentUser.personalization || {};
};

const createEmailVerificationToken=()=>{
    const token=crypto.randomBytes(32).toString('hex');
    const hashedToken=crypto.createHash('sha256').update(token).digest('hex');
    const expires=new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {token,hashedToken,expires};
};

const buildVerificationUrl=(token)=>{
    const clientUrl=process.env.CLIENT_URL || 'http://localhost:5173';
    return `${clientUrl.replace(/\/$/,'')}/verify-email?token=${token}`;
};

const sendVerificationForUser=async (currentUser)=>{
    const {token,hashedToken,expires}=createEmailVerificationToken();
    currentUser.emailVerificationToken=hashedToken;
    currentUser.emailVerificationExpires=expires;
    await currentUser.save();

    await sendEmailVerification({
        to:currentUser.email,
        name:currentUser.name,
        verificationUrl:buildVerificationUrl(token)
    });

    return expires;
};

const registerUser=async (req,res)=>{
    try {
        const {name,email,password,role,companyName}=req.body;

        if(!name||!email||!password||!role){
            return res.status(400).json({message:"All fields are required"});

        }
        const existingUser=await user.findOne({email})

        if(existingUser){
            return res.status(400).json({message:"User already exists"});

        }

        const hashedPassword=await bycrypt.hash(password,10);

        const newUser=new user({
            name,
            email,
            password:hashedPassword,
            role,
            companyName:role==='employer' ? companyName:undefined,
            employerRole:role==='employer' ? 'owner':undefined
        })

        await newUser.save();

        let verificationEmailSent=false;
        let verificationEmailError='';

        try {
            await sendVerificationForUser(newUser);
            verificationEmailSent=true;
        } catch (mailError) {
            verificationEmailError=mailError.message;
            console.error('Email verification send failed:', mailError.message);
        }

        const token=jwt.sign(
            {id:newUser._id, role:newUser.role},
           process.env.JWT_SECRET,
           {expiresIn:'7d'}
        );

        res.status(201).json({
            user:{
                id:newUser._id,
                name:newUser.name,
               email:newUser.email,
               role:newUser.role,
               companyName:newUser.companyName,
               emailVerified:newUser.emailVerified
            },
            token,
            verificationEmailSent,
            verificationEmailError
        })

       
    } catch (error) {
        console.error(error);
        res.status(500).json({message:'Something went wrong'});
        
    }
};

const loginUser=async (req,res)=>{
    try {
        const {email,password}=req.body;

        if(!email||!password){
            return res.status(400).json({message:"Email and Password are required"});
        }

        const UserOne=await user.findOne({email});
        if(!UserOne){
            return res.status(401).json({message:"Invalid email or password"});
        }

        const matching= await bycrypt.compare(password,UserOne.password);
            if(!matching){
                return res.status(401).json({message:"Enter the Correct password"});
            }

        const token=jwt.sign(
            {id:UserOne._id, role:UserOne.role},
            process.env.JWT_SECRET,
            {expiresIn:'7d'}
        );

        res.json({
            user:{
                id:UserOne._id,
                name:UserOne.name,
                email:UserOne.email,
                role:UserOne.role,
                companyName:UserOne.companyName,
                emailVerified:UserOne.emailVerified
            },
            token,
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({message:'Something went wrong'});
        
    }
};

const verifyEmail=async (req,res)=>{
    const {token}=req.query;
    if(!token){
        return res.status(400).json({message:'Verification token is required'});
    }

    const hashedToken=crypto.createHash('sha256').update(token).digest('hex');
    const currentUser=await user.findOne({
        emailVerificationToken:hashedToken,
        emailVerificationExpires:{$gt:new Date()}
    });

    if(!currentUser){
        return res.status(400).json({message:'Verification link is invalid or expired'});
    }

    currentUser.emailVerified=true;
    currentUser.emailVerificationToken=undefined;
    currentUser.emailVerificationExpires=undefined;
    await currentUser.save();

    res.json({message:'Email verified successfully'});
};

const resendVerificationEmail=async (req,res)=>{
    if(req.user.emailVerified){
        return res.status(400).json({message:'Email is already verified'});
    }

    try {
        const expires=await sendVerificationForUser(req.user);
        res.json({message:'Verification email sent',expires});
    } catch (error) {
        res.status(error.statusCode || 500).json({message:error.message || 'Failed to send verification email'});
    }
};

const getCurrentUser=async (req,res)=>{
    const subscription=await Subscription.findOne({
        user:req.user._id,
        status:'active',
        $or:[{expiresAt:{$exists:false}},{expiresAt:null},{expiresAt:{$gt:new Date()}}]
    }).populate('plan');

    res.json({user:req.user,subscription});
};

const updateProfile=async (req,res)=>{
    const allowedFields=[
        'name','companyName','companyWebsite','companyLogo','profileImage','industry','companyDescription',
        'bio','skills','education','experience','resumeUrl','resumeText','expectedRate','availability'
    ];

    allowedFields.forEach(field=>{
        if(req.body[field]!==undefined){
            req.user[field]=field==='skills' && typeof req.body[field]==='string'
                ? req.body[field].split(',').map(skill=>skill.trim()).filter(Boolean)
                : req.body[field];
        }
    });

    await req.user.save();

    res.json({
        user:{
            id:req.user._id,
            name:req.user.name,
            email:req.user.email,
            role:req.user.role,
            companyName:req.user.companyName,
            companyWebsite:req.user.companyWebsite,
            companyLogo:req.user.companyLogo,
            profileImage:req.user.profileImage,
            industry:req.user.industry,
            companyDescription:req.user.companyDescription,
            bio:req.user.bio,
            skills:req.user.skills,
            education:req.user.education,
            experience:req.user.experience,
            resumeUrl:req.user.resumeUrl,
            resumeText:req.user.resumeText,
            expectedRate:req.user.expectedRate,
            availability:req.user.availability
        }
    });
};

const uploadResume=async (req,res)=>{
    if(!req.file){
        return res.status(400).json({message:'Please upload a PDF, DOC, or DOCX resume'});
    }

    try {
        const result=await uploadBufferToCloudinary(req.file,{
            folder:`jobs-parlour/${req.user._id}/resumes`,
            resourceType:'raw'
        });

        req.user.resumeUrl=result.secure_url;
        await req.user.save();

        res.status(201).json({
            message:'Resume uploaded',
            resumeUrl:result.secure_url,
            publicId:result.public_id,
            resourceType:result.resource_type
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({message:error.message || 'Failed to upload resume'});
    }
};

const uploadProfileImage=async (req,res)=>{
    if(!req.file){
        return res.status(400).json({message:'Please upload an image'});
    }

    try {
        const result=await uploadBufferToCloudinary(req.file,{
            folder:`jobs-parlour/${req.user._id}/images`,
            resourceType:'image'
        });

        if(req.user.role==='employer' && req.body.target==='companyLogo'){
            req.user.companyLogo=result.secure_url;
        } else {
            req.user.profileImage=result.secure_url;
        }

        await req.user.save();

        res.status(201).json({
            message:'Image uploaded',
            imageUrl:result.secure_url,
            companyLogo:req.user.companyLogo,
            profileImage:req.user.profileImage,
            publicId:result.public_id,
            resourceType:result.resource_type
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({message:error.message || 'Failed to upload image'});
    }
};

const uploadGenericFile=async (req,res)=>{
    if(!req.file){
        return res.status(400).json({message:'Please upload a file'});
    }

    try {
        const result=await uploadBufferToCloudinary(req.file,{
            folder:`jobs-parlour/${req.user._id}/files`,
            resourceType:'auto'
        });

        res.status(201).json({
            message:'File uploaded',
            fileUrl:result.secure_url,
            publicId:result.public_id,
            resourceType:result.resource_type,
            format:result.format
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({message:error.message || 'Failed to upload file'});
    }
};

const getOnboarding=async (req,res)=>{
    res.json({
        onboarding:req.user.onboarding || {},
        personalization:req.user.personalization || {},
        profileCompleteness:calculateProfileCompleteness(req.user)
    });
};

const updateOnboarding=async (req,res)=>{
    const {currentStep,completedSteps,answers,completed}=req.body;
    ensureUserSetupObjects(req.user);

    if(currentStep!==undefined) req.user.onboarding.currentStep=currentStep;
    if(Array.isArray(completedSteps)) req.user.onboarding.completedSteps=completedSteps;
    if(answers!==undefined) req.user.onboarding.answers={
        ...(req.user.onboarding.answers || {}),
        ...answers
    };
    if(completed!==undefined){
        req.user.onboarding.completed=Boolean(completed);
        req.user.onboarding.completedAt=completed ? new Date() : undefined;
    }

    await req.user.save();
    res.json({onboarding:req.user.onboarding});
};

const getPersonalization=async (req,res)=>{
    res.json({personalization:req.user.personalization || {}});
};

const updatePersonalization=async (req,res)=>{
    ensureUserSetupObjects(req.user);
    const allowedFields=[
        'targetRoles','preferredLocations','preferredJobTypes','preferredWorkplaces','preferredIndustries',
        'salaryMin','salaryMax','openToBids','bidCurrency','skillsToImprove','hiringGoals','companySize',
        'preferredCandidateSkills','hiringBudgetMin','hiringBudgetMax','jobPostFrequency',
        'applicantSortPreference','notificationPreferences','locale','timezone'
    ];

    allowedFields.forEach(field=>{
        if(req.body[field]!==undefined){
            req.user.personalization[field]=req.body[field];
        }
    });

    await req.user.save();
    res.json({personalization:req.user.personalization});
};

const calculateProfileCompleteness=(profile)=>{
    const roleFields=profile.role==='employer'
        ? ['name','email','companyName','companyWebsite','industry','companyDescription']
        : ['name','email','bio','skills','education','experience','resumeUrl'];

    const completed=roleFields.filter(field=>{
        const value=profile[field];
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }).length;

    return Math.round((completed / roleFields.length) * 100);
};

const getSavedJobs=async (req,res)=>{
    const currentUser=await user.findById(req.user._id).populate({
        path:'savedJobs',
        populate:{path:'createdBy',select:'name companyName companyLogo industry'}
    });

    res.json(currentUser.savedJobs || []);
};

const toggleSavedJob=async (req,res)=>{
    const job=await Job.findById(req.params.jobId);
    if(!job) return res.status(404).json({message:'Job not found'});

    const savedJobs=req.user.savedJobs.map(id=>id.toString());
    const alreadySaved=savedJobs.includes(req.params.jobId);

    req.user.savedJobs=alreadySaved
        ? req.user.savedJobs.filter(id=>id.toString()!==req.params.jobId)
        : [...req.user.savedJobs, req.params.jobId];

    await req.user.save();
    res.json({saved:!alreadySaved,savedJobs:req.user.savedJobs});
};

const getNotifications=async (req,res)=>{
    const notifications=await Notification.find({user:req.user._id}).sort({createdAt:-1}).limit(50);
    res.json(notifications);
};

const markNotificationsRead=async (req,res)=>{
    await Notification.updateMany({user:req.user._id,read:false},{read:true});
    res.json({message:'Notifications marked as read'});
};

const getAdminStats=async (req,res)=>{
    const [users,jobs,activeJobs,applications,reports]=await Promise.all([
        user.countDocuments(),
        Job.countDocuments(),
        Job.countDocuments({status:'active'}),
        Job.aggregate([{ $project:{ count:{ $size:'$applications' } } },{ $group:{ _id:null,total:{ $sum:'$count' } } }]),
        Report.countDocuments({status:{$in:['open','reviewing']}})
    ]);

    res.json({
        users,
        jobs,
        activeJobs,
        applications:applications[0]?.total || 0,
        openReports:reports
    });
};

const getAdminUsers=async (req,res)=>{
    const users=await user.find().select('-password').sort({createdAt:-1});
    res.json(users);
};

const getAdminJobs=async (req,res)=>{
    const jobs=await Job.find().populate('createdBy','name email companyName').sort({createdAt:-1});
    res.json(jobs);
};

const updateAdminUser=async (req,res)=>{
    const allowedRoles=['admin','employer','jobseeker'];
    const payload={};

    if(req.body.name!==undefined) payload.name=req.body.name;
    if(req.body.companyName!==undefined) payload.companyName=req.body.companyName;
    if(req.body.role!==undefined){
        if(!allowedRoles.includes(req.body.role)){
            return res.status(400).json({message:'Invalid role'});
        }
        payload.role=req.body.role;
    }

    const updatedUser=await user.findByIdAndUpdate(req.params.id,payload,{new:true}).select('-password');
    if(!updatedUser) return res.status(404).json({message:'User not found'});

    res.json(updatedUser);
};

const deleteAdminUser=async (req,res)=>{
    if(req.params.id===req.user._id.toString()){
        return res.status(400).json({message:'Admins cannot delete their own account'});
    }

    const deletedUser=await user.findByIdAndDelete(req.params.id);
    if(!deletedUser) return res.status(404).json({message:'User not found'});

    await Job.deleteMany({createdBy:req.params.id});
    res.json({message:'User and their jobs deleted'});
};

const deleteAdminJob=async (req,res)=>{
    const deletedJob=await Job.findByIdAndDelete(req.params.id);
    if(!deletedJob) return res.status(404).json({message:'Job not found'});

    res.json({message:'Job deleted'});
};

const getAdminReports=async (req,res)=>{
    const reports=await Report.find()
        .populate('job','title location status')
        .populate('reportedBy','name email role')
        .sort({createdAt:-1});

    res.json(reports);
};

const updateAdminReport=async (req,res)=>{
    const allowedStatuses=['open','reviewing','resolved','dismissed'];
    if(req.body.status && !allowedStatuses.includes(req.body.status)){
        return res.status(400).json({message:'Invalid report status'});
    }

    const report=await Report.findByIdAndUpdate(
        req.params.id,
        {status:req.body.status},
        {new:true}
    )
        .populate('job','title location status')
        .populate('reportedBy','name email role');

    if(!report) return res.status(404).json({message:'Report not found'});
    res.json(report);
};

const addTeamMember = async (req, res) => {
  try {
    const { name, email, password, employerRole } = req.body;

    if (!name || !email || !password || !employerRole) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!['recruiter', 'hiring_manager'].includes(employerRole)) {
      return res.status(400).json({ message: 'Invalid team role. Must be recruiter or hiring_manager' });
    }

    // Only owner can add team members
    const isOwner = req.user.role === 'employer' && (!req.user.companyId || req.user.employerRole === 'owner');
    if (!isOwner) {
      return res.status(403).json({ message: 'Only company owners can manage the team' });
    }

    const existingUser = await user.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const hashedPassword = await bycrypt.hash(password, 10);
    const newMember = await user.create({
      name,
      email,
      password: hashedPassword,
      role: 'employer',
      employerRole,
      companyId: req.user._id,
      companyName: req.user.companyName,
      emailVerified: true // auto-verify since they are added by company owner
    });

    res.status(201).json({
      id: newMember._id,
      name: newMember.name,
      email: newMember.email,
      role: newMember.role,
      employerRole: newMember.employerRole,
      companyId: newMember.companyId
    });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const getTeamMembers = async (req, res) => {
  try {
    const ownerId = req.user.companyId || req.user._id;
    const members = await user.find({ companyId: ownerId }).select('-password');
    res.json(members);
  } catch (error) {
    console.error('Error listing team members:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const removeTeamMember = async (req, res) => {
  try {
    const isOwner = req.user.role === 'employer' && (!req.user.companyId || req.user.employerRole === 'owner');
    if (!isOwner) {
      return res.status(403).json({ message: 'Only company owners can manage the team' });
    }

    const memberId = req.params.id;
    const member = await user.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    if (member.companyId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'This user is not a member of your company' });
    }

    await user.deleteOne({ _id: memberId });
    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports={
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
    removeTeamMember
};
