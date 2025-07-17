import { useContext, useState, useEffect } from "react";
import axios from "axios";
import { AuthContext } from "../context/authContext";
import JobForm from "../components/JobForm";
import JobCard from "../components/JobCard";
import EmployerApplicants from "./EmployerApplicants";

const EmployerDashboard = () => {
    const { user } = useContext(AuthContext);
    const [jobs, setJobs] = useState([]);
    const [editingJob, setEditingJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showJobForm, setShowJobForm] = useState(false);
    const [activeTab, setActiveTab] = useState('jobs'); 

    const headers = {
        Authorization: `Bearer ${user?.token}`
    };

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const res = await axios.get(import.meta.env.VITE_REACT_APP_JOBS_URL, { headers });
            if (!Array.isArray(res.data)) {
                throw new Error("Jobs not returned as array");
            }

            const myJobs = res.data.filter(job => {
                return job.createdBy && job.createdBy._id === user.user.id;
            });

            setJobs(myJobs);
        } catch (err) {
            console.error("Error fetching jobs:", err.message || err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUpdateJobs = async (jobData) => {
        try {
            if (editingJob) {
                await axios.put(`${import.meta.env.VITE_REACT_APP_JOBS_URL}/${editingJob._id}`, jobData, { headers });
            } else {
                await axios.post(import.meta.env.VITE_REACT_APP_CREATEJOBS_URL, jobData, { headers });
            }
            fetchJobs();
            setEditingJob(null);
            setShowJobForm(false);
        } catch (err) {
            console.error("Job create/update error:", err);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this job?')) {
            try {
                await axios.delete(`${import.meta.env.VITE_REACT_APP_JOBS_URL}/${id}`, { headers });
                fetchJobs();
            } catch (err) {
                console.error("Error deleting job:", err);
            }
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    // Calculate statistics
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(job => job.status !== 'closed').length;
    const totalSalary = jobs.reduce((sum, job) => sum + job.salary, 0);
    const averageSalary = totalJobs > 0 ? Math.round(totalSalary / totalJobs) : 0;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-orange-600 to-emerald-700 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-bold mb-2">Employer Dashboard</h1>
                            <p className="text-xl text-green-100">Manage your job postings and find the perfect candidates</p>
                        </div>
                        <div className="hidden md:block">
                            <div className="bg-white/10  rounded-lg p-4">
                                <div className="text-sm text-violet-700">Welcome back,</div>
                                <div className="font-semibold">{user?.user?.name || 'Employer'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
                        <div className="bg-white/10  rounded-lg p-6 text-center">
                            <div className="text-3xl font-bold mb-2">{totalJobs}</div>
                            <div className="text-green-100">Total Jobs Posted</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                            <div className="text-3xl font-bold mb-2">{activeJobs}</div>
                            <div className="text-green-100">Active Jobs</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                            <div className="text-3xl font-bold mb-2">KSH {averageSalary.toLocaleString()}</div>
                            <div className="text-green-100">Average Salary</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                            <div className="text-3xl font-bold mb-2">{totalJobs - activeJobs}</div>
                            <div className="text-green-100">Closed Jobs</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Tab Navigation */}
                <div className="flex flex-wrap gap-2 mb-8">
                  <button
                    className={`w-full sm:w-auto px-4 py-2 rounded-t-lg font-semibold focus:outline-none ${activeTab === 'jobs' ? 'bg-white border-b-2 border-green-600 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    onClick={() => setActiveTab('jobs')}
                  >
                    Job Management
                  </button>
                  <button
                    className={`w-full sm:w-auto px-4 py-2 rounded-t-lg font-semibold focus:outline-none ${activeTab === 'applicants' ? 'bg-white border-b-2 border-green-600 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    onClick={() => setActiveTab('applicants')}
                  >
                    Applicants
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'jobs' && (
                  <>
                    {/* Action Bar */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 flex-wrap">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Job Management</h2>
                                <p className="text-gray-600 mt-1">Create and manage your job postings</p>
                            </div>
                            <button
                                onClick={() => {
                                    setEditingJob(null);
                                    setShowJobForm(true);
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center w-full sm:w-auto"
                            >
                                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Post New Job
                            </button>
                        </div>
                    </div>

                    {/* Job Form Modal */}
                    {showJobForm && (
                      <div className="fixed inset-0 flex items-center justify-center z-50 bg-transparent">
                        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 border border-gray-200">
                          {/* Close Button */}
                          <button
                            onClick={() => {
                              setShowJobForm(false);
                              setEditingJob(null);
                            }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold focus:outline-none"
                          >
                            ×
                          </button>

                          {/* Title and Description */}
                          <h3 className="text-xl font-bold text-gray-900 mb-1">
                            {editingJob ? 'Edit Job' : 'Post New Job'}
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">
                            {editingJob
                              ? 'Update your job posting details'
                              : 'Create a new job posting to attract candidates'}
                          </p>

                          {/* Job Form */}
                          <JobForm
                            onSubmit={handleCreateUpdateJobs}
                            editingJob={editingJob}
                            onCancel={() => {
                              setShowJobForm(false);
                              setEditingJob(null);
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Jobs Section */}
                    <div className="space-y-6">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-green-600">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Loading your jobs...
                                </div>
                            </div>
                        ) : jobs.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="mx-auto h-24 w-24 text-gray-300 mb-4">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs posted yet</h3>
                                <p className="text-gray-500 mb-6">Get started by posting your first job opportunity</p>
                                <button
                                    onClick={() => {
                                        setEditingJob(null);
                                        setShowJobForm(true);
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                                >
                                    Post Your First Job
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        Your Job Postings ({jobs.length})
                                    </h2>
                                    <div className="text-sm text-gray-500">
                                        Manage your job listings
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 gap-y-4 min-w-0">
                                    {jobs.map(job => (
                                        <JobCard
                                            key={job._id}
                                            job={job}
                                            onEdit={(job) => {
                                                setEditingJob(job);
                                                setShowJobForm(true);
                                            }}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                  </>
                )}
                {activeTab === 'applicants' && (
                  <EmployerApplicants />
                )}
            </div>
        </div>
    );
};

export default EmployerDashboard;