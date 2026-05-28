import { useState, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/authContext';
import axios from 'axios';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);

  const isEmployer = user?.user?.role === 'employer';
  const isJobSeeker = user?.user?.role === 'jobseeker';
  const isAdmin = user?.user?.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    if (!user?.token) {
      setNotificationUnreadCount(0);
      setMessageUnreadCount(0);
      return undefined;
    }

    const authBaseUrl = import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '');
    const messagesBaseUrl = `${authBaseUrl}/messages`;
    const headers = { Authorization: `Bearer ${user.token}` };

    const fetchCounts = async () => {
      try {
        const [notificationRes, conversationsRes] = await Promise.all([
          axios.get(`${authBaseUrl}/notifications`, { headers }),
          axios.get(messagesBaseUrl, { headers })
        ]);
        setNotificationUnreadCount(Number(notificationRes.data?.unreadCount || 0));
        const totalUnreadMessages = (Array.isArray(conversationsRes.data) ? conversationsRes.data : [])
          .reduce((sum, conversation) => sum + Number(conversation.unreadCount || 0), 0);
        setMessageUnreadCount(totalUnreadMessages);
      } catch {
        setNotificationUnreadCount(0);
        setMessageUnreadCount(0);
      }
    };

    fetchCounts();
    const timer = window.setInterval(fetchCounts, 30000);
    return () => window.clearInterval(timer);
  }, [user]);

  // Handle hash navigation
  const handleHashClick = (e, hash) => {
    e.preventDefault();
    const element = document.getElementById(hash);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

 
  const navLinks = [
    { to: '/dashboard', label: 'JobSeeker Dashboard', show: isJobSeeker && user },
    { to: '/my-applications', label: 'My Applications', show: isJobSeeker && user },
    { to: '/saved-jobs', label: 'Saved Jobs', show: isJobSeeker && user },
    { to: '/employer-dashboard', label: 'Employer Dashboard', show: isEmployer && user },
    { to: '/messages', label: 'Messages', show: Boolean(user), badge: messageUnreadCount },
    { to: '/admin', label: 'Admin', show: isAdmin && user },
    { to: '/profile', label: 'Profile', show: Boolean(user) },
    { to: '/notifications', label: 'Notifications', show: Boolean(user), badge: notificationUnreadCount },
    { to: '/', label: 'Home', show: !user },
    { to: '/#about', label: 'About', show: location.pathname === '/', isHashLink: true, hash: 'about' },
    { to: '/#services', label: 'Services', show: location.pathname === '/', isHashLink: true, hash: 'services' },
    { to: '/#contact', label: 'Contact', show: location.pathname === '/', isHashLink: true, hash: 'contact' },
    { to: '/register', label: 'Register', show: !user },
    { to: '/login', label: 'Login', show: !user },
  ];

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-2xl font-bold text-blue-600">JobsParlour</Link>
          </div>
          <div className="hidden md:flex space-x-4 items-center">
            {navLinks.filter(l => l.show).map(link => (
              link.isHashLink ? (
                <a
                  key={link.to}
                  href={link.to}
                  onClick={(e) => handleHashClick(e, link.hash)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${location.pathname === link.to ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${location.pathname === link.to ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{link.label}</span>
                    {link.badge > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                        {link.badge}
                      </span>
                    )}
                  </span>
                </Link>
              )
            ))}
            {user && (
              <button
                onClick={handleLogout}
                className="ml-2 px-3 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors duration-200"
              >
                Logout
              </button>
            )}
          </div>
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-blue-50 focus:outline-none"
            >
              <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden px-2 pt-2 pb-3 space-y-1 bg-white shadow">
          {navLinks.filter(l => l.show).map(link => (
            link.isHashLink ? (
              <a
                key={link.to}
                href={link.to}
                onClick={(e) => { setMenuOpen(false); handleHashClick(e, link.hash); }}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${location.pathname === link.to ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${location.pathname === link.to ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
              >
                <span className="inline-flex items-center gap-2">
                  <span>{link.label}</span>
                  {link.badge > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                      {link.badge}
                    </span>
                  )}
                </span>
              </Link>
            )
          ))}
          {user && (
            <button
              onClick={() => { setMenuOpen(false); handleLogout(); }}
              className="w-full text-left px-3 py-2 rounded-md text-base font-medium bg-red-500 text-white hover:bg-red-600 transition-colors duration-200 mt-1"
            >
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar; 
