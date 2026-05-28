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

const stageLabels = {
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offered: 'Offered',
  hired: 'Hired',
  rejected: 'Rejected',
};

const MyApplications = () => {
  const { user } = useContext(AuthContext);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingInviteId, setDownloadingInviteId] = useState('');
  const jobsBaseUrl = import.meta.env.VITE_REACT_APP_JOBS_URL;

  const downloadInvite = async (applicationId, inviteUrl) => {
    if (!inviteUrl) return;
    setDownloadingInviteId(applicationId);
    try {
      const res = await axios.get(`${jobsBaseUrl}${inviteUrl.replace('/api/jobs', '')}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
        responseType: 'blob'
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'text/calendar' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `interview-${applicationId}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setError('Could not download the interview invite.');
    } finally {
      setDownloadingInviteId('');
    }
  };

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
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                    Stage: {stageLabels[app.stage] || app.stage || 'Applied'}
                  </span>
                  {app.unreadMessages > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                      {app.unreadMessages} unread message{app.unreadMessages === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                {app.interviews?.length > 0 && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 mb-3">
                    <div className="text-sm font-semibold text-emerald-900">Upcoming interviews</div>
                    <div className="space-y-2 mt-2">
                      {app.interviews.slice(0, 2).map((interview) => (
                        <div key={interview._id || interview.scheduledAt} className="rounded-lg bg-white/70 px-3 py-2 text-sm text-emerald-800">
                          <div>{new Date(interview.scheduledAt).toLocaleString()} · {interview.type || 'Interview'} · {interview.status}</div>
                          {interview.meetingLink && (
                            <a href={interview.meetingLink} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                              Open meeting link
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {app.nextAction && (
                  <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="text-sm font-semibold text-blue-900">Next action</div>
                    <div className="text-sm text-blue-800 mt-1">{app.nextAction.label}</div>
                    <div className="text-sm text-blue-700 mt-1">{app.nextAction.detail}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {app.nextAction.link && (
                        <Link to={app.nextAction.link} className="text-blue-700 font-medium hover:underline">
                          Open
                        </Link>
                      )}
                      {app.nextAction.inviteUrl && (
                        <button
                          type="button"
                          onClick={() => downloadInvite(app._id, app.nextAction.inviteUrl)}
                          disabled={downloadingInviteId === app._id}
                          className="text-blue-700 font-medium hover:underline disabled:opacity-60"
                        >
                          {downloadingInviteId === app._id ? 'Downloading invite...' : 'Add to calendar'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {app.timeline?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-900 mb-2">Timeline</div>
                    <div className="space-y-2">
                      {app.timeline.slice(-4).reverse().map((event, index) => (
                        <div key={`${event.type}-${event.timestamp}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="text-sm font-medium text-gray-900">{event.title}</div>
                          <div className="text-sm text-gray-600 mt-1">{event.description}</div>
                          <div className="text-xs text-gray-400 mt-2">{new Date(event.timestamp).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap justify-between items-center text-sm mt-2 gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {app.job?.location}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-200 text-gray-700 font-medium">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Applied: {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                  {app.unreadMessages > 0 ? (
                    <Link to={`/messages?jobId=${app.job?._id}`} className="text-amber-700 font-medium hover:underline">Reply to message</Link>
                  ) : null}
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
