import { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/authContext';

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [moderationQueue, setModerationQueue] = useState({ flaggedJobs: [], employers: [] });

  useEffect(() => {
    const fetchAdminData = async () => {
      const base = import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '');
      const headers = { Authorization: `Bearer ${user.token}` };
      const [statsRes, usersRes, jobsRes, auditLogsRes, moderationRes] = await Promise.all([
        axios.get(`${base}/admin/stats`, { headers }),
        axios.get(`${base}/admin/users`, { headers }),
        axios.get(`${base}/admin/jobs`, { headers }),
        axios.get(`${base}/admin/audit-logs`, { headers }),
        axios.get(`${base}/admin/moderation`, { headers })
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setJobs(jobsRes.data);
      setAuditLogs(Array.isArray(auditLogsRes.data) ? auditLogsRes.data : []);
      setModerationQueue(moderationRes.data || { flaggedJobs: [], employers: [] });
    };

    fetchAdminData();
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(stats).map(([key, value]) => (
              <div key={key} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="text-sm text-gray-500 capitalize">{key}</div>
                <div className="text-3xl font-bold text-gray-900">{value}</div>
              </div>
            ))}
          </div>
        )}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Users</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <tbody>
                {users.map((item) => (
                  <tr key={item._id} className="border-t">
                    <td className="py-3 pr-4 font-medium">{item.name}</td>
                    <td className="py-3 pr-4">{item.email}</td>
                    <td className="py-3 capitalize">{item.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Jobs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => (
              <div key={job._id} className="border border-gray-200 rounded-lg p-4">
                <div className="font-semibold">{job.title}</div>
                <div className="text-sm text-gray-500">{job.createdBy?.companyName || job.createdBy?.name}</div>
                <div className="text-sm text-gray-600 capitalize mt-1">{job.status} · {job.applications?.length || 0} applications</div>
                {job.moderation?.isFlagged && (
                  <div className="text-xs text-amber-700 mt-2">
                    Flagged · score {job.moderation?.suspiciousScore || 0}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Moderation Queue</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Flagged Jobs</h3>
              <div className="space-y-3">
                {(moderationQueue.flaggedJobs || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No flagged jobs right now.</p>
                ) : moderationQueue.flaggedJobs.map((job) => (
                  <div key={job._id} className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                    <div className="font-semibold text-gray-900">{job.title}</div>
                    <div className="text-sm text-gray-600">{job.createdBy?.companyName || job.createdBy?.name}</div>
                    <div className="text-sm text-amber-800 mt-2">
                      Score: {job.moderation?.suspiciousScore || 0} · {job.moderation?.reviewStatus || 'none'}
                    </div>
                    <div className="text-xs text-amber-700 mt-2">
                      {(job.moderation?.reasons || []).join(' • ') || 'No reasons recorded'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Employers Needing Review</h3>
              <div className="space-y-3">
                {(moderationQueue.employers || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No employers in the queue.</p>
                ) : moderationQueue.employers.map((employer) => (
                  <div key={employer._id} className="border border-gray-200 rounded-lg p-4">
                    <div className="font-semibold text-gray-900">{employer.companyName || employer.name}</div>
                    <div className="text-sm text-gray-600">{employer.email}</div>
                    <div className="text-sm text-gray-700 mt-2 capitalize">
                      Verification: {employer.employerVerification?.status || 'unverified'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Reports: {employer.trustFlags?.reportCount || 0} · Suspicious jobs: {employer.trustFlags?.suspiciousJobCount || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Audit Logs</h2>
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No audit entries yet.</p>
            ) : auditLogs.map((log) => (
              <div key={log._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-900">{String(log.action || '').replace(/\./g, ' ')}</div>
                    <div className="text-sm text-gray-600">{log.actorName || 'Unknown user'}{log.actorRole ? ` (${log.actorRole})` : ''}</div>
                    <div className="text-sm text-gray-500 mt-1">{log.metadata?.title || log.metadata?.planSlug || log.metadata?.purpose || log.entityType}</div>
                  </div>
                  <div className="text-sm text-gray-400">{new Date(log.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
