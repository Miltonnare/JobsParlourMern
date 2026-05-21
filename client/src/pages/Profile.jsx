import { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/authContext';

const Profile = () => {
  const { user, updateAuthUser } = useContext(AuthContext);
  const [form, setForm] = useState({
    name: '',
    bio: '',
    skills: '',
    education: '',
    experience: '',
    resumeUrl: '',
    resumeText: '',
    expectedRate: '',
    availability: '',
    companyName: '',
    companyWebsite: '',
    companyLogo: '',
    profileImage: '',
    industry: '',
    companyDescription: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const res = await axios.get(`${import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '')}/me`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const profile = res.data.user;
      setForm({
        name: profile.name || '',
        bio: profile.bio || '',
        skills: (profile.skills || []).join(', '),
        education: profile.education || '',
        experience: profile.experience || '',
        resumeUrl: profile.resumeUrl || '',
        resumeText: profile.resumeText || '',
        expectedRate: profile.expectedRate || '',
        availability: profile.availability || '',
        companyName: profile.companyName || '',
        companyWebsite: profile.companyWebsite || '',
        companyLogo: profile.companyLogo || '',
        profileImage: profile.profileImage || '',
        industry: profile.industry || '',
        companyDescription: profile.companyDescription || ''
      });
    };

    fetchProfile();
  }, [user]);

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('resume', file);

    const res = await axios.post(
      `${import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '')}/resume`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    setForm({ ...form, resumeUrl: res.data.resumeUrl });
    toast.success('Resume uploaded');
  };

  const handleImageUpload = async (event, target = 'profileImage') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('target', target);

    const res = await axios.post(
      `${import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '')}/upload/image`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    setForm({
      ...form,
      companyLogo: res.data.companyLogo || form.companyLogo,
      profileImage: res.data.profileImage || form.profileImage
    });
    toast.success('Image uploaded');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const res = await axios.put(`${import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '')}/profile`, form, {
      headers: { Authorization: `Bearer ${user.token}` }
    });
    updateAuthUser(res.data.user);
    toast.success('Profile updated');
  };

  const isEmployer = user?.user?.role === 'employer';

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <input name="name" value={form.name} onChange={handleChange} placeholder="Name" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
        {isEmployer ? (
          <>
            <input name="companyName" value={form.companyName} onChange={handleChange} placeholder="Company name" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <input name="companyWebsite" value={form.companyWebsite} onChange={handleChange} placeholder="Company website" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <input name="companyLogo" value={form.companyLogo} onChange={handleChange} placeholder="Logo URL" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, 'companyLogo')} className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white" />
            <input name="industry" value={form.industry} onChange={handleChange} placeholder="Industry" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <textarea name="companyDescription" value={form.companyDescription} onChange={handleChange} placeholder="Company description" rows="5" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
          </>
        ) : (
          <>
            <input name="profileImage" value={form.profileImage} onChange={handleChange} placeholder="Profile image URL" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, 'profileImage')} className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white" />
            <textarea name="bio" value={form.bio} onChange={handleChange} placeholder="Bio" rows="4" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <input name="skills" value={form.skills} onChange={handleChange} placeholder="Skills separated by commas" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <input name="education" value={form.education} onChange={handleChange} placeholder="Education" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <input name="experience" value={form.experience} onChange={handleChange} placeholder="Experience" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <input name="resumeUrl" value={form.resumeUrl} onChange={handleChange} placeholder="Resume URL" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white" />
            <textarea name="resumeText" value={form.resumeText} onChange={handleChange} placeholder="Paste resume text for ATS matching" rows="6" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="expectedRate" value={form.expectedRate} onChange={handleChange} type="number" placeholder="Expected rate or bid" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
              <input name="availability" value={form.availability} onChange={handleChange} placeholder="Availability" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            </div>
          </>
        )}
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">Save Profile</button>
      </form>
    </div>
  );
};

export default Profile;
