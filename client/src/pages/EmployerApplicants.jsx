import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/authContext';

const EmployerApplicants = () => {
  const { user } = useContext(AuthContext);
  const [jobsWithApplicants, setJobsWithApplicants] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
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

    fetchApplicants();
  }, [user]);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {jobsWithApplicants.map((job) => (
            <div
              key={job.jobId}
              className="bg-white rounded-2xl shadow-lg border border-emerald-200 hover:shadow-2xl transition-shadow duration-300 p-6 flex flex-col w-full"
            >
              <h3 className="text-xl font-bold text-indigo-700 mb-2 flex items-center gap-2">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 01.88 7.903A5.5 5.5 0 1112 6.5c.338 0 .672.03 1 .086" /></svg>
                {job.title}
              </h3>
              {job.applications.length === 0 ? (
                <p className="text-gray-400 mt-2 italic">No applicants yet.</p>
              ) : (
                <ul className="space-y-4 mt-4">
                  {job.applications.map((app) => (
                    <li
                      key={app._id}
                      className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col gap-1 shadow-sm hover:bg-emerald-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="font-semibold text-emerald-800">{app.applicantId?.name}</span>
                        <span className="ml-auto text-xs text-gray-400">{app.applicantId?.email}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-gray-700">Applied on:</span>{' '}
                        <span className="text-indigo-600">{app.appliedAt ? new Date(app.appliedAt).toLocaleString() : 'Unknown'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployerApplicants; 