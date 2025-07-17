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
        <h2 className="text-2xl font-bold mb-4">Applicants for Your Jobs</h2>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Applicants for Your Jobs</h2>
      {Array.isArray(jobsWithApplicants) && jobsWithApplicants.length === 0 ? (
        <p>No jobs with applicants yet.</p>
      ) : (
        Array.isArray(jobsWithApplicants) && jobsWithApplicants.map((job) => (
          <div key={job.jobId} className="mb-6 border p-4 rounded shadow">
            <h3 className="text-xl font-semibold text-indigo-600">{job.title}</h3>
            {job.applications.length === 0 ? (
              <p className="text-gray-500 mt-2">No applicants yet.</p>
            ) : (
              <ul className="list-disc ml-6 mt-2">
                {job.applications.map((app) => (
                  <li key={app._id}>
                    <p><strong>Name:</strong> {app.applicantId?.name}</p>
                    <p><strong>Email:</strong> {app.applicantId?.email}</p>
                    <p><strong>Applied on:</strong> {new Date(app.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default EmployerApplicants; 