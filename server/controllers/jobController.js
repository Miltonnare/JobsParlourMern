
const Job = require('../models/jobModel');
const User = require('../models/userModel');

const createJob=async (req,res)=>{
    const {title,description,location,jobType,salary}=req.body;

    if(!title||!location){
        return res.status(400).json({message:"Title and Location are mandatory"});
    }

    const newJob=await Job.create({
        title,
        description,
        location,
        jobType,
        salary,
        createdBy:req.user._id


    });

    res.status(201).json(newJob);
};


const getAllJobs=async (req,res)=>{
    const Jobs=await Job.find().populate('createdBy','name companyName');

    res.json(Jobs);
};

const getJobById=async (req,res)=>{
    const job=await Job.findById(req.params.id).populate('createdBy','name companyName');

    if(!job) return res.status(404).json({message:'Job Not Found'});

    res.json(job);
};

const updateJob=async (req,res)=>{
    const job=await Job.findById(req.params.id);

    if(!job) return res.status(404).json({message:'Job Not Found'});

    if(job.createdBy.toString()!==req.user._id.toString()){
        return res.status(403).json({message:"Not Authorized to Update this Job"});
    }

    const updated=await Job.findByIdAndUpdate(req.params.id,
        req.body,        
      { new: true } 
    );

    res.json(updated);
}

const deleteJob=async (req,res)=>{
    const job=await Job.findById(req.params.id);
    if(!job) {
        return res.status(404).json({message:"Job Not Found"})
    };

    if (job.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Not authorized to delete this job" });
  };

  await Job.deleteOne();
  res.json({ message: "Job deleted" });
};

const applyToJob = async (req, res) => {
  const jobId = req.params.id;
  const userId = req.user._id;

  const job = await Job.findById(jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });

 
  const alreadyApplied = job.applications.find(app => app.user.toString() === userId.toString());
  if (alreadyApplied) return res.status(400).json({ message: 'You already applied for this job' });

  job.applications.push({ user: userId });
  await job.save();

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
    const employerId = req.user.id; // from auth middleware

    const jobs = await Job.find({ postedBy: employerId });

    const jobsWithApplicants = await Promise.all(
      jobs.map(async (job) => {
        const applications = await Application.find({ jobId: job._id }).populate('applicantId', 'name email');
        return {
          jobId: job._id,
          title: job.title,
          applications,
        };
      })
    );

    res.json(jobsWithApplicants);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
  
}


module.exports={
    createJob,
    getAllJobs,
    getJobById,
    updateJob,
    deleteJob,
    applyToJob,
    getMyApplications,
    getMyApplicantsForEmployerByJobs
};
