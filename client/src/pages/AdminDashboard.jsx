import { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/authContext';

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    const fetchAdminData = async () => {
      const base = import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '');
      const headers = { Authorization: `Bearer ${user.token}` };
      const [statsRes, usersRes, jobsRes] = await Promise.all([
        axios.get(`${base}/admin/stats`, { headers }),
        axios.get(`${base}/admin/users`, { headers }),
        axios.get(`${base}/admin/jobs`, { headers })
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setJobs(jobsRes.data);
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
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
