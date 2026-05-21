import { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import JobItem from '../components/JobItem';
import { AuthContext } from '../context/authContext';

const SavedJobs = () => {
  const { user } = useContext(AuthContext);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSavedJobs = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '')}/saved-jobs`,
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        setJobs(res.data.map((job) => ({ ...job, isSaved: true })));
      } catch (error) {
        console.error('Failed to fetch saved jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedJobs();
  }, [user]);

  if (loading) return <div className="text-center py-12">Loading saved jobs...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Saved Jobs</h1>
        {jobs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">No saved jobs yet.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {jobs.map((job) => <JobItem key={job._id} job={job} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedJobs;
