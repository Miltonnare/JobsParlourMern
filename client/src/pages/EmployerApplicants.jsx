import { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/authContext';

const STAGES = ['applied', 'screening', 'interviewing', 'offered', 'hired', 'rejected'];

const EmployerApplicants = () => {
  const { user } = useContext(AuthContext);
  const [jobsWithApplicants, setJobsWithApplicants] = useState([]);
  const [boardSummary, setBoardSummary] = useState(null);
  const [filters, setFilters] = useState({
    jobId: 'all',
    stage: 'all',
    status: 'all',
    archived: 'active',
    sort: 'newest',
    search: ''
  });
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [bulkAction, setBulkAction] = useState({ action: 'move_stage', stage: 'screening' });
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchApplicants = async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params[key] = value;
      });

      const res = await axios.get(import.meta.env.VITE_REACT_APP_MY_APPLICANTS_URL, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        params
      });

      const jobs = Array.isArray(res.data?.jobs) ? res.data.jobs : [];
      setJobsWithApplicants(jobs);
      setBoardSummary(res.data?.summary || null);
      setError('');
      setSelectedApplicationIds([]);
      setSelectedApplication(null);

      if (jobs.length === 0) {
        setSelectedJobId('');
      } else if (!jobs.some((job) => String(job.jobId) === String(selectedJobId))) {
        setSelectedJobId(String(jobs[0].jobId));
      }
    } catch (err) {
      setJobsWithApplicants([]);
      setBoardSummary(null);
      setError(err.response?.data?.message || 'Error fetching applicants.');
      console.error('Error fetching applicants:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicants();
  }, [user, filters.jobId, filters.stage, filters.status, filters.archived, filters.sort, filters.search]);

  const selectedJob = jobsWithApplicants.find((job) => String(job.jobId) === String(selectedJobId)) || jobsWithApplicants[0] || null;
  const selectedApplicationsSet = new Set(selectedApplicationIds);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
    if (name === 'jobId') {
      setSelectedJobId(value === 'all' ? '' : value);
    }
  };

  const toggleApplicationSelection = (applicationId) => {
    setSelectedApplicationIds((current) => (
      current.includes(applicationId)
        ? current.filter((id) => id !== applicationId)
        : [...current, applicationId]
    ));
  };

  const toggleStageSelection = (stage) => {
    if (!selectedJob) return;
    const stageIds = (selectedJob.pipeline?.[stage] || []).map((application) => String(application._id));
    const allSelected = stageIds.length > 0 && stageIds.every((id) => selectedApplicationsSet.has(id));

    if (allSelected) {
      setSelectedApplicationIds((current) => current.filter((id) => !stageIds.includes(id)));
      return;
    }

    setSelectedApplicationIds((current) => [...new Set([...current, ...stageIds])]);
  };

  const runBulkAction = async () => {
    if (!selectedJob || selectedApplicationIds.length === 0) {
      setError('Select at least one application first.');
      return;
    }

    setBulkLoading(true);
    try {
      const payload = {
        applicationIds: selectedApplicationIds,
        action: bulkAction.action
      };

      if (bulkAction.action === 'move_stage') payload.stage = bulkAction.stage;
      if (bulkAction.action === 'set_status') payload.status = bulkAction.status;

      await axios.patch(
        `${import.meta.env.VITE_REACT_APP_JOBS_URL}/${selectedJob.jobId}/applications/bulk`,
        payload,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      setSelectedApplicationIds([]);
      await fetchApplicants();
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk action failed.');
    } finally {
      setBulkLoading(false);
    }
  };

  const openApplicationDetails = (application) => {
    setSelectedApplication(application);
  };

  if (error && !loading) {
    return (
      <div className="p-6">
        <h2 className="text-3xl font-extrabold mb-4 text-rose-700">Applicants for Your Jobs</h2>
        <p className="text-red-600 bg-red-100 rounded p-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-rose-50 via-emerald-50 to-indigo-50 min-h-screen space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-emerald-700 drop-shadow">ATS Workspace</h2>
          <p className="text-sm text-gray-600 mt-2">Manage candidates by stage, score, and bulk pipeline actions.</p>
        </div>
        <button
          type="button"
          onClick={fetchApplicants}
          className="px-4 py-2 rounded-lg border border-emerald-200 bg-white text-emerald-700 font-medium hover:bg-emerald-50"
        >
          Refresh board
        </button>
      </div>

      {boardSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Applicants</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{boardSummary.totalApplicants || 0}</div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Active</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{boardSummary.activeApplicants || 0}</div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Archived</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{boardSummary.archivedApplicants || 0}</div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Average ATS</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{boardSummary.averageAtsScore || 0}%</div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Interviews</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{boardSummary.interviewsScheduled || 0}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <select name="jobId" value={filters.jobId} onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2">
            <option value="all">All jobs</option>
            {jobsWithApplicants.map((job) => (
              <option key={job.jobId} value={job.jobId}>{job.title}</option>
            ))}
          </select>
          <select name="stage" value={filters.stage} onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2">
            <option value="all">All stages</option>
            {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
          <select name="status" value={filters.status} onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="rejected">Rejected</option>
            <option value="hired">Hired</option>
          </select>
          <select name="archived" value={filters.archived} onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2">
            <option value="active">Active only</option>
            <option value="archived">Archived only</option>
            <option value="all">All records</option>
          </select>
          <select name="sort" value={filters.sort} onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="ats-high">ATS highest</option>
            <option value="ats-low">ATS lowest</option>
            <option value="bid-high">Bid highest</option>
            <option value="bid-low">Bid lowest</option>
          </select>
          <input
            name="search"
            value={filters.search}
            onChange={handleFilterChange}
            placeholder="Search candidates or skills"
            className="border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-3">
            <select
              value={bulkAction.action}
              onChange={(event) => setBulkAction((current) => ({ ...current, action: event.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="move_stage">Move to stage</option>
              <option value="archive">Archive</option>
              <option value="unarchive">Unarchive</option>
              <option value="set_status">Set status</option>
            </select>
            {bulkAction.action === 'move_stage' && (
              <select
                value={bulkAction.stage}
                onChange={(event) => setBulkAction((current) => ({ ...current, stage: event.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            )}
            {bulkAction.action === 'set_status' && (
              <select
                value={bulkAction.status || 'shortlisted'}
                onChange={(event) => setBulkAction((current) => ({ ...current, status: event.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="pending">Pending</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="rejected">Rejected</option>
                <option value="hired">Hired</option>
              </select>
            )}
            <button
              type="button"
              onClick={runBulkAction}
              disabled={bulkLoading || selectedApplicationIds.length === 0 || !selectedJob}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50 hover:bg-indigo-700"
            >
              {bulkLoading ? 'Updating...' : `Apply to ${selectedApplicationIds.length} selected`}
            </button>
          </div>
          <div className="text-sm text-gray-500">
            {selectedJob ? `${selectedJob.title} · ${selectedJob.summary?.totalApplicants || 0} filtered applicants` : 'No job selected'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500 border border-emerald-100">
          Loading ATS board...
        </div>
      ) : jobsWithApplicants.length === 0 || !selectedJob ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500 border border-emerald-100">
          No applicants matched the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500">Job applicants</div>
                <div className="text-2xl font-bold text-gray-900 mt-2">{selectedJob.summary?.totalApplicants || 0}</div>
              </div>
              <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500">Average ATS</div>
                <div className="text-2xl font-bold text-gray-900 mt-2">{selectedJob.summary?.averageAtsScore || 0}%</div>
              </div>
              <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500">Interviews</div>
                <div className="text-2xl font-bold text-gray-900 mt-2">{selectedJob.summary?.interviewsScheduled || 0}</div>
              </div>
              <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500">Hires</div>
                <div className="text-2xl font-bold text-gray-900 mt-2">{selectedJob.summary?.hiredCount || 0}</div>
              </div>
            </div>

            <div className="overflow-x-auto pb-4">
            <div className="grid grid-flow-col auto-cols-[290px] gap-4 min-w-max">
              {STAGES.map((stage) => {
                const applications = selectedJob.pipeline?.[stage] || [];
                const allStageSelected = applications.length > 0 && applications.every((application) => selectedApplicationsSet.has(String(application._id)));

                return (
                  <div key={stage} className="bg-white rounded-2xl shadow-lg border border-emerald-200 p-4 flex flex-col min-h-[520px]">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-indigo-700">{stage}</h3>
                        <p className="text-xs text-gray-500 mt-1">{applications.length} candidate{applications.length === 1 ? '' : 's'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleStageSelection(stage)}
                        className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        {allStageSelected ? 'Clear' : 'Select all'}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {applications.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-400 text-center">
                          No candidates in this stage.
                        </div>
                      ) : applications.map((application) => {
                        const applicationId = String(application._id);
                        const isSelected = selectedApplicationsSet.has(applicationId);
                        const isActive = String(selectedApplication?._id) === applicationId;

                        return (
                          <div
                            key={applicationId}
                            className={`rounded-xl border p-3 shadow-sm cursor-pointer transition ${
                              isActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'
                            }`}
                            onClick={() => openApplicationDetails(application)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <label className="flex items-start gap-2 flex-1 cursor-pointer" onClick={(event) => event.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleApplicationSelection(applicationId)}
                                  className="mt-1"
                                />
                                <div>
                                  <div className="font-semibold text-emerald-800">{application.applicantId?.name || 'Applicant'}</div>
                                  <div className="text-xs text-gray-500">{application.applicantId?.email}</div>
                                </div>
                              </label>
                              {application.archived && (
                                <span className="text-[10px] px-2 py-1 rounded-full bg-gray-200 text-gray-600">Archived</span>
                              )}
                            </div>

                            <div className="mt-3 text-xs text-gray-500">
                              Applied {application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : 'recently'}
                            </div>

                            <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-100 p-2">
                              <div className="text-sm font-semibold text-indigo-700">ATS {application.ats?.score || 0}%</div>
                              <div className="text-xs text-indigo-600 mt-1 line-clamp-2">
                                {(application.ats?.matchedKeywords || []).slice(0, 5).join(', ') || 'No keyword matches captured yet.'}
                              </div>
                            </div>

                            {application.candidateSnapshot?.skills?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-3">
                                {application.candidateSnapshot.skills.slice(0, 4).map((skill) => (
                                  <span key={skill} className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">{skill}</span>
                                ))}
                              </div>
                            )}

                            {application.bid?.amount && (
                              <div className="mt-3 text-sm text-gray-700">
                                {application.bid.currency || 'USD'} {Number(application.bid.amount).toLocaleString()} {application.bid.type || 'fixed'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 p-5 h-fit">
            {!selectedApplication ? (
              <div className="text-sm text-gray-500">Select a candidate card to view their full details, notes, score, and resume links.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xl font-bold text-gray-900">{selectedApplication.applicantId?.name || 'Applicant'}</div>
                  <div className="text-sm text-gray-500 mt-1">{selectedApplication.applicantId?.email}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                    <div className="text-xs text-indigo-600 uppercase tracking-wide">Stage</div>
                    <div className="text-sm font-semibold text-indigo-900 mt-1">{selectedApplication.stage || 'applied'}</div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                    <div className="text-xs text-emerald-600 uppercase tracking-wide">ATS score</div>
                    <div className="text-sm font-semibold text-emerald-900 mt-1">{selectedApplication.ats?.score || 0}%</div>
                  </div>
                </div>

                {selectedApplication.note && (
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">Candidate note</div>
                    <p className="text-sm text-gray-700">{selectedApplication.note}</p>
                  </div>
                )}

                {selectedApplication.candidateSnapshot?.bio && (
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">Bio</div>
                    <p className="text-sm text-gray-700">{selectedApplication.candidateSnapshot.bio}</p>
                  </div>
                )}

                {selectedApplication.candidateSnapshot?.skills?.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">Skills</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedApplication.candidateSnapshot.skills.map((skill) => (
                        <span key={skill} className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedApplication.ats?.missingKeywords?.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">Missing keywords</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedApplication.ats.missingKeywords.map((keyword) => (
                        <span key={keyword} className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 text-xs">{keyword}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-sm text-gray-700">
                  <div>Interviews scheduled: {selectedApplication.interviews?.length || 0}</div>
                  <div>Status: {selectedApplication.status || 'pending'}</div>
                  <div>Archived: {selectedApplication.archived ? 'Yes' : 'No'}</div>
                </div>

                {selectedApplication.resumeUrl && (
                  <a
                    href={selectedApplication.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                  >
                    Open resume
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerApplicants;
