import { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/authContext';

const Notifications = () => {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      const base = import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '');
      const res = await axios.get(`${base}/notifications`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
      await axios.put(`${base}/notifications/read`, {}, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
    };

    fetchNotifications();
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Notifications</h1>
        <div className="text-sm text-gray-500 mb-4">{unreadCount} unread notification{unreadCount === 1 ? '' : 's'} when loaded</div>
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">No notifications yet.</div>
          ) : notifications.map((notification) => (
            <div key={notification._id} className={`bg-white border rounded-lg p-4 ${notification.read ? 'border-gray-200' : 'border-blue-300'}`}>
              <div className="font-medium text-gray-900">{notification.message}</div>
              {notification.link && (
                <a href={notification.link} className="text-sm text-blue-600 hover:underline mt-2 inline-block">Open related page</a>
              )}
              <div className="text-sm text-gray-500 mt-1">{new Date(notification.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
