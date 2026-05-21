import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import JobItem from '../components/JobItem';
import { AuthContext } from '../context/authContext';

const JobDetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_REACT_APP_JOBS_URL}/${id}`);
        let isSaved = false;
        if (user?.token && user?.user?.role === 'jobseeker') {
          const savedRes = await axios.get(
            `${import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '')}/saved-jobs`,
            { headers: { Authorization: `Bearer ${user.token}` } }
          );
          isSaved = savedRes.data.some((savedJob) => savedJob._id === id);
        }
        setJob({ ...res.data, isSaved });
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load job.');
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id, user]);

  if (loading) return <div className="text-center py-12">Loading job...</div>;
  if (error) return <div className="text-center py-12 text-red-600">{error}</div>;
  if (!job) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <JobItem job={job} />
        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Company</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            <div>
              <div className="font-semibold">{job.createdBy?.companyName || job.createdBy?.name || 'Company'}</div>
              <div>{job.createdBy?.industry || 'Industry not listed'}</div>
            </div>
            {job.createdBy?.companyWebsite && (
              <a href={job.createdBy.companyWebsite} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                {job.createdBy.companyWebsite}
              </a>
            )}
          </div>
          {job.createdBy?.companyDescription && (
            <p className="mt-4 text-gray-700">{job.createdBy.companyDescription}</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default JobDetails;
