import { useContext, useEffect, useRef, useState } from 'react';
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
  const [resumeParsing, setResumeParsing] = useState({
    status: 'idle',
    warning: '',
    failureReason: '',
    sourceFileName: '',
    extractedCharacters: 0,
    progressPercent: 0,
    currentStage: 'idle'
  });
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const processingTimerRef = useRef(null);

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
      setResumeParsing({
        status: profile.resumeParsing?.status || 'idle',
        warning: profile.resumeParsing?.warning || '',
        failureReason: profile.resumeParsing?.failureReason || '',
        sourceFileName: profile.resumeParsing?.sourceFileName || '',
        extractedCharacters: profile.resumeParsing?.extractedCharacters || 0,
        progressPercent: profile.resumeParsing?.status === 'parsed' ? 100 : 0,
        currentStage: profile.resumeParsing?.status === 'parsed' ? 'complete' : 'idle'
      });
    };

    fetchProfile();
    return () => {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current);
      }
    };
  }, [user]);

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('resume', file);

    try {
      setIsUploadingResume(true);
      setResumeParsing({
        status: 'processing',
        warning: '',
        failureReason: '',
        sourceFileName: file.name,
        extractedCharacters: 0,
        progressPercent: 5,
        currentStage: 'uploading'
      });

      const res = await axios.post(
        `${import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '')}/resume`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || file.size || 0;
            if (!total) return;

            const uploadPercent = Math.min(Math.round((progressEvent.loaded / total) * 45), 45);
            setResumeParsing((current) => ({
              ...current,
              status: 'processing',
              progressPercent: Math.max(current.progressPercent || 0, uploadPercent),
              currentStage: 'uploading'
            }));

            if (progressEvent.loaded >= total) {
              setResumeParsing((current) => ({
                ...current,
                progressPercent: Math.max(current.progressPercent || 0, 55),
                currentStage: 'extracting'
              }));

              if (!processingTimerRef.current) {
                processingTimerRef.current = setInterval(() => {
                  setResumeParsing((current) => {
                    const nextProgress = Math.min((current.progressPercent || 55) + 7, 92);
                    const currentStage = nextProgress < 72 ? 'extracting' : 'structuring';

                    return {
                      ...current,
                      progressPercent: nextProgress,
                      currentStage
                    };
                  });
                }, 350);
              }
            }
          }
        }
      );

      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current);
        processingTimerRef.current = null;
      }

      setForm((current) => ({
        ...current,
        resumeUrl: res.data.resumeUrl || current.resumeUrl,
        resumeText: res.data.resumeText || current.resumeText,
        skills: res.data.parsedResume?.skills?.length ? res.data.parsedResume.skills.join(', ') : current.skills
      }));
      setResumeParsing({
        status: res.data.resumeParsing?.status || 'idle',
        warning: res.data.resumeParsing?.warning || '',
        failureReason: res.data.resumeParsing?.failureReason || '',
        sourceFileName: res.data.resumeParsing?.sourceFileName || file.name,
        extractedCharacters: res.data.resumeParsing?.extractedCharacters || 0,
        progressPercent: 100,
        currentStage: 'complete'
      });
      updateAuthUser({
        resumeUrl: res.data.resumeUrl,
        resumeText: res.data.resumeText,
        parsedResume: res.data.parsedResume,
        resumeParsing: res.data.resumeParsing
      });
      toast.success(
        res.data.resumeParsing?.status === 'parsed'
          ? 'Resume uploaded and parsed'
          : 'Resume uploaded. Please review extracted text.'
      );
    } catch (error) {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current);
        processingTimerRef.current = null;
      }
      setResumeParsing((current) => ({
        ...current,
        status: 'failed',
        failureReason: error.response?.data?.message || 'Resume upload failed',
        currentStage: 'failed'
      }));
      toast.error(error.response?.data?.message || 'Resume upload failed');
    } finally {
      setIsUploadingResume(false);
    }
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
  const resumeStatusTone = {
    parsed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    processing: 'border-amber-200 bg-amber-50 text-amber-800',
    needs_review: 'border-orange-200 bg-orange-50 text-orange-800',
    failed: 'border-red-200 bg-red-50 text-red-800',
    idle: 'border-gray-200 bg-gray-50 text-gray-700'
  };
  const processingStages = [
    { id: 'uploading', label: 'Uploading document' },
    { id: 'extracting', label: 'Extracting text' },
    { id: 'structuring', label: 'Structuring data' },
    { id: 'complete', label: 'Done' }
  ];
  const currentStageIndex = processingStages.findIndex((stage) => stage.id === resumeParsing.currentStage);

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
            <div className={`rounded-lg border px-4 py-3 text-sm ${resumeStatusTone[resumeParsing.status] || resumeStatusTone.idle}`}>
              <div className="font-medium capitalize">
                Resume parsing: {resumeParsing.status === 'needs_review' ? 'needs review' : resumeParsing.status}
              </div>
              {(isUploadingResume || resumeParsing.progressPercent > 0) && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                    <span>
                      {resumeParsing.currentStage === 'uploading' && 'Uploading your file'}
                      {resumeParsing.currentStage === 'extracting' && 'Running text extraction'}
                      {resumeParsing.currentStage === 'structuring' && 'Structuring the extracted content'}
                      {resumeParsing.currentStage === 'complete' && 'Processing complete'}
                      {resumeParsing.currentStage === 'failed' && 'Processing failed'}
                    </span>
                    <span>{resumeParsing.progressPercent}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
                    <div
                      className="h-full rounded-full bg-current transition-all duration-300"
                      style={{ width: `${resumeParsing.progressPercent}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {processingStages.map((stage, index) => {
                      const isComplete = currentStageIndex >= index || (resumeParsing.currentStage === 'complete' && resumeParsing.progressPercent === 100);
                      const isCurrent = resumeParsing.currentStage === stage.id;

                      return (
                        <div
                          key={stage.id}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                            isComplete
                              ? 'border-current/20 bg-white/70'
                              : 'border-gray-200 bg-white/40 text-gray-500'
                          }`}
                        >
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                            isCurrent || isComplete ? 'border-current bg-white' : 'border-gray-300'
                          }`}>
                            {isComplete ? '✓' : index + 1}
                          </span>
                          <span>{stage.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {resumeParsing.sourceFileName && (
                <div className="mt-1">File: {resumeParsing.sourceFileName}</div>
              )}
              {resumeParsing.extractedCharacters > 0 && (
                <div className="mt-1">Extracted characters: {resumeParsing.extractedCharacters}</div>
              )}
              {resumeParsing.warning && (
                <div className="mt-1">{resumeParsing.warning}</div>
              )}
              {resumeParsing.failureReason && (
                <div className="mt-1">{resumeParsing.failureReason}</div>
              )}
            </div>
            <textarea name="resumeText" value={form.resumeText} onChange={handleChange} placeholder="Paste resume text for ATS matching" rows="6" className="w-full border border-gray-300 rounded-lg px-4 py-3" />
            <p className="text-sm text-gray-500">
              Review the extracted resume text after upload. Scanned PDFs and older Word files may need manual cleanup.
            </p>
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
