import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/authContext';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  shortlisted: 'bg-blue-100 text-blue-800',
  hired: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const MyApplications = () => {
  const { user } = useContext(AuthContext);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(
          import.meta.env.VITE_REACT_APP_MY_APPLICATIONS_URL,
          { headers: { Authorization: `Bearer ${user?.token}` } }
        );
        setApplications(res.data);
      } catch {
        setError('Failed to fetch applications.');
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, [user]);

  if (loading) return <div className="text-center py-12">Loading your applications...</div>;
  if (error) return <div className="text-center text-red-500 py-12">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-2">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800 text-center">My Applications</h1>
        {applications.length === 0 ? (
          <div className="text-gray-500 text-center bg-white rounded-lg shadow p-8">You have not applied to any jobs yet.</div>
        ) : (
          <div className="space-y-6">
            {applications.map((app) => (
              <div key={app._id} className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow duration-200">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h2 className="text-xl font-semibold text-emerald-700">{app.job?.title || 'Job Title'}</h2>
                    <div className="text-gray-500 text-sm">{app.job?.companyName || 'Company'}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[app.status] || statusColors['pending']}`}>{app.status || 'pending'}</span>
                </div>
                <div className="text-gray-700 mb-2">{app.job?.description?.slice(0, 120) || 'No description.'}</div>
                {app.note && <div className="text-sm text-gray-600 mb-2">Your note: {app.note}</div>}
                <div className="flex flex-wrap gap-2 mb-2 text-sm">
                  {app.bid?.amount && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                      Bid: {app.bid.currency || 'USD'} {Number(app.bid.amount).toLocaleString()} {app.bid.type || 'fixed'}
                    </span>
                  )}
                  {app.ats && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                      ATS: {app.ats.score || 0}%
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap justify-between items-center text-sm mt-2 gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {app.job?.location}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-200 text-gray-700 font-medium">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Applied: {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                  <Link to={`/jobs/${app.job?._id}`} className="text-blue-600 font-medium hover:underline">View job</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyApplications; 
