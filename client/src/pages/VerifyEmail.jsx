import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('Verifying your email...');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      if (!token) {
        setStatus('Verification token is missing.');
        return;
      }

      try {
        const baseUrl = import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '');
        const res = await axios.get(`${baseUrl}/verify-email`, { params: { token } });
        setStatus(res.data.message || 'Email verified successfully.');
      } catch (error) {
        setStatus(error.response?.data?.message || 'Email verification failed.');
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Email Verification</h1>
        <p className="text-gray-600 mb-6">{status}</p>
        <Link to="/login" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium">
          Continue to Login
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmail;
