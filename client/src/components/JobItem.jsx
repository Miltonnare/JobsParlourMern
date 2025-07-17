
import { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/authContext';
import { toast } from 'react-hot-toast';

const JobItem = ({ job, onApplySuccess }) => {
    const { user } = useContext(AuthContext);
    const [isApplying, setIsApplying] = useState(false);
    const [hasApplied, setHasApplied] = useState(false);
    const [error, setError] = useState('');

    // Check if user has already applied
    const checkIfApplied = () => {
        if (job.applications && user?.user?.id) {
            return job.applications.some(app => app.user === user.user.id);
        }
        return false;
    };

    const handleApply = async () => {
        if (!user) {
            setError('Please login to apply for this job');
            toast.error('Please login to apply for this job');
            return;
        }

        setIsApplying(true);
        setError('');

        try {
            const token = user.token;
            const response = await axios.post(
                `${import.meta.env.VITE_REACT_APP_JOBS_URL}/${job._id}/apply`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            setHasApplied(true);
            toast.success('Application submitted!');
            if (onApplySuccess) {
                onApplySuccess(job._id);
            }
        } catch (error) {
            console.error('Error applying to job:', error);
            if (error.response?.data?.message) {
                setError(error.response.data.message);
                if (error.response.data.message === 'You already applied for this job') {
                    toast.error('You already applied');
                } else {
                    toast.error(error.response.data.message);
                }
            } else {
                setError('Failed to apply for this job. Please try again.');
                toast.error('Failed to apply for this job. Please try again.');
            }
        } finally {
            setIsApplying(false);
        }
    };

    const getTypeColor = (type) => {
        switch (type?.toLowerCase()) {
            case 'full-time':
                return 'bg-green-100 text-green-800';
            case 'part-time':
                return 'bg-blue-100 text-blue-800';
            case 'contract':
                return 'bg-purple-100 text-purple-800';
            case 'internship':
                return 'bg-orange-100 text-orange-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 p-6 text-base">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-y-2">
                <div className="flex-1">
                    {/* Job Header */}
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors duration-200">
                            {job.title}
                        </h3>
                        <div className="flex items-center space-x-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(job.Type)}`}>
                                {job.Type}
                            </span>
                        </div>
                    </div>

                    {/* Company and Location */}
                    <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                        <div className="flex items-center">
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span>{job.companyName || 'Company Name'}</span>
                        </div>
                        <div className="flex items-center">
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{job.location}</span>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-gray-700 mb-4 line-clamp-3">
                        {job.description}
                    </p>

                    {/* Job Details */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Salary */}
                            <div className="flex items-center text-green-600 font-semibold">
                                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                                <span>KSH {job.salary?.toLocaleString()}</span>
                            </div>

                            {/* Posted Date */}
                            <div className="flex items-center text-gray-500 text-sm">
                                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Posted recently</span>
                            </div>
                        </div>

                        {/* Apply Button */}
                        <div className="flex flex-col items-end space-y-2 w-full sm:w-auto mt-4 sm:mt-0">
                            {error && (
                                <p className="text-red-500 text-sm">{error}</p>
                            )}
                            <button 
                                onClick={handleApply}
                                disabled={isApplying || hasApplied || checkIfApplied()}
                                className={`w-full sm:w-auto px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center ${
                                    hasApplied || checkIfApplied()
                                        ? 'bg-green-600 text-white cursor-not-allowed'
                                        : isApplying
                                        ? 'bg-gray-400 text-white cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            >
                                {isApplying ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Applying...
                                    </>
                                ) : hasApplied || checkIfApplied() ? (
                                    <>
                                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Applied
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Apply Now
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobItem;