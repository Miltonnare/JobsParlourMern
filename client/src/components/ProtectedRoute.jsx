import { useContext, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/authContext';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  // Add navigation guard for browser back button
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear any stored redirect paths when leaving the app
      sessionStorage.removeItem('redirectAfterLogin');
    };

    const handlePopState = () => {
      // Handle browser back button
      if (!user || !user.token) {
        window.location.href = '/login';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [user]);

  // Check if user is authenticated
  if (!user || !user.token) {
    // Store the attempted location for redirect after login
    sessionStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to="/login" replace />;
  }

  // Check if user has the required role (if specified)
  if (requiredRole && user.user?.role !== requiredRole) {
    // Redirect to appropriate dashboard based on actual role
    if (user.user?.role === 'employer') {
      return <Navigate to="/employer-dashboard" replace />;
    } else if (user.user?.role === 'jobseeker') {
      return <Navigate to="/dashboard" replace />;
    } else {
      // Unknown role, redirect to login
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
