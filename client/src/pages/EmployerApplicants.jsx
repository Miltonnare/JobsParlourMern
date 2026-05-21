import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/authContext';

const EmployerApplicants = () => {
  const { user } = useContext(AuthContext);
  const [jobsWithApplicants, setJobsWithApplicants] = useState([]);
  const [error, setError] = useState('');

  const fetchApplicants = async () => {
      try {
        const res = await axios.get(import.meta.env.VITE_REACT_APP_MY_APPLICANTS_URL, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (Array.isArray(res.data)) {
          setJobsWithApplicants(res.data);
          setError('');
        } else {
          setJobsWithApplicants([]);
          setError(res.data?.message || 'Unexpected response from server.');
        }
      } catch (err) {
        setJobsWithApplicants([]);
        setError(err.response?.data?.message || 'Error fetching applicants.');
        console.error('Error fetching applicants:', err.response?.data || err.message);
      }
    };

  useEffect(() => {

    fetchApplicants();
  }, [user]);

  const updateStatus = async (jobId, applicationId, status) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_REACT_APP_JOBS_URL}/${jobId}/applications/${applicationId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      fetchApplicants();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update application status.');
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-3xl font-extrabold mb-4 text-rose-700">Applicants for Your Jobs</h2>
        <p className="text-red-600 bg-red-100 rounded p-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-rose-50 via-emerald-50 to-indigo-50 min-h-screen">
      <h2 className="text-3xl font-extrabold mb-8 text-emerald-700 drop-shadow">Applicants for Your Jobs</h2>
      {Array.isArray(jobsWithApplicants) && jobsWithApplicants.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500 border border-emerald-100">
          <p>No jobs with applicants yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {jobsWithApplicants.map((job) => (
            <div
              key={job.jobId}
              className="bg-white rounded-xl shadow-lg border border-emerald-200 p-6 w-full"
            >
              <h3 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 01.88 7.903A5.5 5.5 0 1112 6.5c.338 0 .672.03 1 .086" /></svg>
                {job.title}
              </h3>
              {job.applications.length === 0 ? (
                <p className="text-gray-400 mt-2 italic">No applicants yet.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  {['pending', 'shortlisted', 'rejected', 'hired'].map((status) => (
                    <div key={status} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <h4 className="font-semibold text-gray-800 capitalize mb-3">{status}</h4>
                      <div className="space-y-3">
                        {job.applications.filter((app) => (app.status || 'pending') === status).map((app) => (
                          <div key={app._id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                            <div className="font-semibold text-emerald-800">{app.applicantId?.name}</div>
                            <div className="text-xs text-gray-500">{app.applicantId?.email}</div>
                            <div className="text-xs text-indigo-600 mt-2">
                              {app.appliedAt ? new Date(app.appliedAt).toLocaleString() : 'Unknown date'}
                            </div>
                            {app.note && <p className="text-sm text-gray-700 mt-2">{app.note}</p>}
                            {app.bid?.amount && (
                              <div className="mt-2 text-sm text-gray-700">
                                <span className="font-medium">Bid:</span>{' '}
                                {app.bid.currency || 'USD'} {Number(app.bid.amount).toLocaleString()} {app.bid.type || 'fixed'}
                              </div>
                            )}
                            {(app.bid?.estimatedDuration || app.bid?.availability) && (
                              <div className="text-xs text-gray-500 mt-1">
                                {[app.bid?.estimatedDuration, app.bid?.availability].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            {app.ats && (
                              <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-100 p-2">
                                <div className="text-sm font-semibold text-indigo-700">ATS Match: {app.ats.score || 0}%</div>
                                {app.ats.matchedKeywords?.length > 0 && (
                                  <div className="text-xs text-indigo-600 mt-1">
                                    {app.ats.matchedKeywords.slice(0, 6).join(', ')}
                                  </div>
                                )}
                              </div>
                            )}
                            {app.candidateSnapshot?.skills?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {app.candidateSnapshot.skills.slice(0, 5).map((skill) => (
                                  <span key={skill} className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">{skill}</span>
                                ))}
                              </div>
                            )}
                            {app.resumeUrl && (
                              <a href={app.resumeUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                                Resume
                              </a>
                            )}
                            <select
                              value={app.status || 'pending'}
                              onChange={(event) => updateStatus(job.jobId, app._id, event.target.value)}
                              className="mt-3 w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
                            >
                              <option value="pending">Pending</option>
                              <option value="shortlisted">Shortlisted</option>
                              <option value="rejected">Rejected</option>
                              <option value="hired">Hired</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployerApplicants; 
