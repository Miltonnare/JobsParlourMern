import { useContext, useState, useEffect } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/authContext";
import JobForm from "../components/JobForm";
import JobCard from "../components/JobCard";
import EmployerApplicants from "./EmployerApplicants";

const EmployerDashboard = () => {
    const { user } = useContext(AuthContext);
    const [jobs, setJobs] = useState([]);
    const [editingJob, setEditingJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showJobForm, setShowJobForm] = useState(false);
    const [activeTab, setActiveTab] = useState('jobs'); 
    const [searchParams] = useSearchParams();
    const [payments, setPayments] = useState([]);
    const [billingPortal, setBillingPortal] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        jobId: '',
        purpose: 'job_posting',
        amount: '1000',
        currency: 'USD'
    });
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentMessage, setPaymentMessage] = useState('');
    const [registrationWarning, setRegistrationWarning] = useState('');
    const [auditLogs, setAuditLogs] = useState([]);
    const [jobFormError, setJobFormError] = useState('');

    const authBaseUrl = import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '');
    const isCompanyOwner = user?.user?.role === 'employer' && (!user?.user?.companyId || user?.user?.employerRole === 'owner');

    const headers = {
        Authorization: `Bearer ${user?.token}`
    };

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const res = await axios.get(import.meta.env.VITE_REACT_APP_JOBS_URL, { headers, params: { status: 'all', limit: 50 } });
            const jobsData = Array.isArray(res.data) ? res.data : res.data.jobs;
            if (!Array.isArray(jobsData)) {
                throw new Error("Jobs not returned as array");
            }

            const myJobs = jobsData.filter(job => {
                return job.createdBy && (job.createdBy._id === user.user.id || job.createdBy === user.user.id);
            });

            setJobs(myJobs);
        } catch (err) {
            console.error("Error fetching jobs:", err.message || err);
        } finally {
            setLoading(false);
        }
    };

    const getPaymentUrl = () => {
        const jobsUrl = import.meta.env.VITE_REACT_APP_JOBS_URL;
        return jobsUrl ? jobsUrl.replace(/\/jobs$/, '/payments') : 'http://localhost:5000/api/payments';
    };

    const fetchPayments = async () => {
        try {
            const res = await axios.get(`${getPaymentUrl()}/history`, { headers });
            setPayments(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error fetching payments:", err.message || err);
        }
    };

    const fetchBillingPortal = async () => {
        try {
            const res = await axios.get(`${getPaymentUrl()}/portal`, { headers });
            setBillingPortal(res.data);
        } catch (err) {
            console.error("Error fetching billing portal:", err.message || err);
        }
    };

    const fetchAuditLogs = async () => {
        if (!isCompanyOwner) return;
        try {
            const res = await axios.get(`${authBaseUrl}/audit-logs`, { headers });
            setAuditLogs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error fetching audit logs:", err.message || err);
        }
    };

    const handleCreateUpdateJobs = async (jobData) => {
        try {
            setJobFormError('');
            if (editingJob) {
                await axios.put(`${import.meta.env.VITE_REACT_APP_JOBS_URL}/${editingJob._id}`, jobData, { headers });
            } else {
                await axios.post(import.meta.env.VITE_REACT_APP_CREATEJOBS_URL, jobData, { headers });
            }
            fetchJobs();
            setEditingJob(null);
            setShowJobForm(false);
        } catch (err) {
            console.error("Job create/update error:", err);
            setJobFormError(err.response?.data?.message || 'Could not save this job.');
            throw err;
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this job?')) {
            try {
                await axios.delete(`${import.meta.env.VITE_REACT_APP_JOBS_URL}/${id}`, { headers });
                fetchJobs();
            } catch (err) {
                console.error("Error deleting job:", err);
            }
        }
    };

    const handleToggleStatus = async (id) => {
        try {
            await axios.patch(`${import.meta.env.VITE_REACT_APP_JOBS_URL}/${id}/status`, {}, { headers });
            fetchJobs();
        } catch (err) {
            console.error("Error updating job status:", err);
        }
    };

    const handlePaymentChange = (event) => {
        setPaymentForm({ ...paymentForm, [event.target.name]: event.target.value });
    };

    const handleInitializePayment = async (event) => {
        event.preventDefault();
        setPaymentLoading(true);
        setPaymentMessage('');

        try {
            const res = await axios.post(`${getPaymentUrl()}/initialize`, paymentForm, { headers });
            window.location.href = res.data.authorizationUrl;
        } catch (err) {
            setPaymentMessage(err.response?.data?.message || 'Could not initialize Paystack payment.');
        } finally {
            setPaymentLoading(false);
        }
    };

    const verifyPaymentReference = async (reference) => {
        setPaymentLoading(true);
        try {
            await axios.get(`${getPaymentUrl()}/verify/${reference}`, { headers });
            setPaymentMessage('Payment verified successfully.');
            fetchPayments();
            fetchBillingPortal();
            fetchJobs();
        } catch (err) {
            setPaymentMessage(err.response?.data?.message || 'Payment verification failed.');
        } finally {
            setPaymentLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
        fetchPayments();
        fetchBillingPortal();
        fetchAuditLogs();

        const storedWarning = sessionStorage.getItem('registrationWarning');
        if (storedWarning) {
            setRegistrationWarning(storedWarning);
            sessionStorage.removeItem('registrationWarning');
        }
    }, []);

    const handleRetryPayment = async (paymentId) => {
        setPaymentLoading(true);
        setPaymentMessage('');
        try {
            const res = await axios.post(`${getPaymentUrl()}/${paymentId}/retry`, {}, { headers });
            if (res.data.authorizationUrl) {
                window.location.href = res.data.authorizationUrl;
                return;
            }
            setPaymentMessage('Retry initialized.');
            fetchPayments();
            fetchBillingPortal();
        } catch (err) {
            setPaymentMessage(err.response?.data?.message || 'Could not retry this payment.');
        } finally {
            setPaymentLoading(false);
        }
    };

    const downloadInvoice = async (paymentId, invoiceNumber) => {
        try {
            const res = await axios.get(`${getPaymentUrl()}/invoices/${paymentId}/download`, {
                headers,
                responseType: 'blob'
            });
            const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${invoiceNumber || 'invoice'}.html`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            setPaymentMessage(err.response?.data?.message || 'Could not download invoice.');
        }
    };

    useEffect(() => {
        const reference = searchParams.get('reference') || searchParams.get('trxref');
        if (reference) {
            setActiveTab('payments');
            verifyPaymentReference(reference);
        }
    }, [searchParams]);

    // Calculate statistics
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(job => job.status !== 'closed').length;
    const totalSalary = jobs.reduce((sum, job) => sum + job.salary, 0);
    const averageSalary = totalJobs > 0 ? Math.round(totalSalary / totalJobs) : 0;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-orange-600 to-emerald-700 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-bold mb-2">Employer Dashboard</h1>
                            <p className="text-xl text-green-100">Manage your job postings and find the perfect candidates</p>
                        </div>
                        <div className="hidden md:block">
                            <div className="bg-white/10  rounded-lg p-4">
                                <div className="text-sm text-violet-700">Welcome back,</div>
                                <div className="font-semibold">{user?.user?.name || 'Employer'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
                        <div className="bg-white/10  rounded-lg p-6 text-center">
                            <div className="text-3xl font-bold mb-2">{totalJobs}</div>
                            <div className="text-green-100">Total Jobs Posted</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                            <div className="text-3xl font-bold mb-2">{activeJobs}</div>
                            <div className="text-green-100">Active Jobs</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                            <div className="text-3xl font-bold mb-2">KSH {averageSalary.toLocaleString()}</div>
                            <div className="text-green-100">Average Salary</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                            <div className="text-3xl font-bold mb-2">{totalJobs - activeJobs}</div>
                            <div className="text-green-100">Closed Jobs</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {registrationWarning && (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {registrationWarning}
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="flex flex-wrap gap-2 mb-8">
                  <button
                    className={`w-full sm:w-auto px-4 py-2 rounded-t-lg font-semibold focus:outline-none ${activeTab === 'jobs' ? 'bg-white border-b-2 border-green-600 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    onClick={() => setActiveTab('jobs')}
                  >
                    Job Management
                  </button>
                  <button
                    className={`w-full sm:w-auto px-4 py-2 rounded-t-lg font-semibold focus:outline-none ${activeTab === 'applicants' ? 'bg-white border-b-2 border-green-600 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    onClick={() => setActiveTab('applicants')}
                  >
                    Applicants
                  </button>
                  <button
                    className={`w-full sm:w-auto px-4 py-2 rounded-t-lg font-semibold focus:outline-none ${activeTab === 'payments' ? 'bg-white border-b-2 border-green-600 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    onClick={() => setActiveTab('payments')}
                  >
                    Payments
                  </button>
                  {isCompanyOwner && (
                    <button
                      className={`w-full sm:w-auto px-4 py-2 rounded-t-lg font-semibold focus:outline-none ${activeTab === 'audit' ? 'bg-white border-b-2 border-green-600 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      onClick={() => setActiveTab('audit')}
                    >
                      Audit Log
                    </button>
                  )}
                </div>

                {/* Tab Content */}
                {activeTab === 'jobs' && (
                  <>
                    {/* Action Bar */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 flex-wrap">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Job Management</h2>
                                <p className="text-gray-600 mt-1">Create and manage your job postings</p>
                            </div>
                            <button
                                onClick={() => {
                                    setEditingJob(null);
                                    setJobFormError('');
                                    setShowJobForm(true);
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center w-full sm:w-auto"
                            >
                                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Post New Job
                            </button>
                        </div>
                    </div>

                    {/* Job Form Modal */}
                    {showJobForm && (
                      <div className="fixed inset-0 flex items-center justify-center z-50 bg-transparent">
                        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 border border-gray-200">
                          {/* Close Button */}
                          <button
                            onClick={() => {
                              setShowJobForm(false);
                              setEditingJob(null);
                              setJobFormError('');
                            }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold focus:outline-none"
                          >
                            ×
                          </button>

                          {/* Title and Description */}
                          <h3 className="text-xl font-bold text-gray-900 mb-1">
                            {editingJob ? 'Edit Job' : 'Post New Job'}
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">
                            {editingJob
                              ? 'Update your job posting details'
                              : 'Create a new job posting to attract candidates'}
                          </p>

                          {/* Job Form */}
                          <JobForm
                            onSubmit={handleCreateUpdateJobs}
                            editingJob={editingJob}
                            errorMessage={jobFormError}
                            onCancel={() => {
                              setShowJobForm(false);
                              setEditingJob(null);
                              setJobFormError('');
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Jobs Section */}
                    <div className="space-y-6">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-green-600">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Loading your jobs...
                                </div>
                            </div>
                        ) : jobs.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="mx-auto h-24 w-24 text-gray-300 mb-4">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs posted yet</h3>
                                <p className="text-gray-500 mb-6">Get started by posting your first job opportunity</p>
                                <button
                                    onClick={() => {
                                        setEditingJob(null);
                                        setJobFormError('');
                                        setShowJobForm(true);
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                                >
                                    Post Your First Job
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        Your Job Postings ({jobs.length})
                                    </h2>
                                    <div className="text-sm text-gray-500">
                                        Manage your job listings
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 gap-y-4 min-w-0">
                                    {jobs.map(job => (
                                        <JobCard
                                            key={job._id}
                                            job={job}
                                            onEdit={(job) => {
                                                setEditingJob(job);
                                                setJobFormError('');
                                                setShowJobForm(true);
                                            }}
                                            onDelete={handleDelete}
                                            onToggleStatus={handleToggleStatus}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                  </>
                )}
                {activeTab === 'applicants' && (
                  <EmployerApplicants />
                )}
                {activeTab === 'payments' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <form onSubmit={handleInitializePayment} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                      <h2 className="text-2xl font-bold text-gray-900">Paystack Checkout</h2>
                      <select
                        name="jobId"
                        value={paymentForm.jobId}
                        onChange={handlePaymentChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                      >
                        <option value="">General employer payment</option>
                        {jobs.map((job) => (
                          <option key={job._id} value={job._id}>{job.title}</option>
                        ))}
                      </select>
                      <select
                        name="purpose"
                        value={paymentForm.purpose}
                        onChange={handlePaymentChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                      >
                        <option value="job_posting">Job posting</option>
                        <option value="featured_job">Feature job</option>
                        <option value="subscription">Subscription</option>
                      </select>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          name="amount"
                          value={paymentForm.amount}
                          onChange={handlePaymentChange}
                          type="number"
                          min="1"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                        />
                        <input
                          name="currency"
                          value={paymentForm.currency}
                          onChange={handlePaymentChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                        />
                      </div>
                      {paymentMessage && <p className="text-sm text-gray-700 bg-gray-100 rounded-lg p-3">{paymentMessage}</p>}
                      <button disabled={paymentLoading} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-6 py-3 rounded-lg font-medium">
                        {paymentLoading ? 'Processing...' : 'Pay with Paystack'}
                      </button>
                    </form>
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-2xl font-bold text-gray-900">Current Billing</h2>
                          <button onClick={() => { fetchPayments(); fetchBillingPortal(); }} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700">Refresh</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="rounded-lg border border-gray-200 p-4">
                            <div className="text-sm text-gray-500">Current plan</div>
                            <div className="font-semibold text-gray-900 mt-1">{billingPortal?.subscription?.plan?.name || 'No active plan'}</div>
                          </div>
                          <div className="rounded-lg border border-gray-200 p-4">
                            <div className="text-sm text-gray-500">Subscription status</div>
                            <div className="font-semibold text-gray-900 mt-1 capitalize">{billingPortal?.subscription?.status || 'none'}</div>
                          </div>
                          <div className="rounded-lg border border-gray-200 p-4">
                            <div className="text-sm text-gray-500">Lifecycle</div>
                            <div className="font-semibold text-gray-900 mt-1">{billingPortal?.lifecycle?.label || 'No billing lifecycle yet'}</div>
                          </div>
                        </div>
                        {billingPortal?.subscription?.gracePeriodEndsAt && (
                          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                            Grace period ends on {new Date(billingPortal.subscription.gracePeriodEndsAt).toLocaleDateString()}.
                          </div>
                        )}
                      </div>

                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Invoices</h2>
                        <div className="space-y-3">
                          {(billingPortal?.invoices || []).length === 0 ? (
                            <p className="text-gray-500">No invoices yet.</p>
                          ) : billingPortal.invoices.map((invoice) => (
                            <div key={invoice.paymentId} className="border border-gray-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                              <div>
                                <div className="font-semibold text-gray-900">{invoice.invoiceNumber}</div>
                                <div className="text-sm text-gray-500">{invoice.plan?.name || invoice.purpose?.replace('_', ' ')}</div>
                                <div className="text-xs text-gray-400">{new Date(invoice.createdAt).toLocaleString()}</div>
                              </div>
                              <div className="flex flex-col lg:items-end gap-2">
                                <div className="font-semibold">{invoice.currency} {(invoice.amount / 100).toLocaleString()}</div>
                                <div className={`text-sm capitalize ${invoice.status === 'success' ? 'text-green-600' : invoice.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>{invoice.status}</div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => downloadInvoice(invoice.paymentId, invoice.invoiceNumber)}
                                    className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm"
                                  >
                                    Download
                                  </button>
                                  {['failed', 'abandoned', 'cancelled'].includes(invoice.status) && (
                                    <button
                                      type="button"
                                      onClick={() => handleRetryPayment(invoice.paymentId)}
                                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm"
                                    >
                                      Retry
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-2xl font-bold text-gray-900">Payment History</h2>
                          <button onClick={fetchPayments} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700">Refresh</button>
                        </div>
                        <div className="space-y-3">
                          {payments.length === 0 ? (
                            <p className="text-gray-500">No payments yet.</p>
                          ) : payments.map((payment) => (
                            <div key={payment._id} className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                              <div>
                                <div className="font-semibold text-gray-900">{payment.purpose?.replace('_', ' ')}</div>
                                <div className="text-sm text-gray-500">{payment.job?.title || payment.plan?.name || 'General payment'}</div>
                                <div className="text-xs text-gray-400">{payment.reference}</div>
                              </div>
                              <div className="text-left md:text-right">
                                <div className="font-semibold">{payment.currency} {(payment.amount / 100).toLocaleString()}</div>
                                <div className={`text-sm capitalize ${payment.status === 'success' ? 'text-green-600' : payment.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>{payment.status}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'audit' && isCompanyOwner && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
                        <p className="text-sm text-gray-500 mt-1">Recent billing, hiring, export, and team actions across your company.</p>
                      </div>
                      <button onClick={fetchAuditLogs} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700">Refresh</button>
                    </div>
                    <div className="space-y-3">
                      {auditLogs.length === 0 ? (
                        <p className="text-gray-500">No audit entries yet.</p>
                      ) : auditLogs.map((log) => (
                        <div key={log._id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                            <div>
                              <div className="font-semibold text-gray-900">{String(log.action || '').replace(/\./g, ' ')}</div>
                              <div className="text-sm text-gray-600">
                                {log.actorName || 'Unknown user'}{log.actorRole ? ` (${log.actorRole})` : ''}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                {log.metadata?.title || log.metadata?.planSlug || log.metadata?.purpose || log.entityType}
                              </div>
                            </div>
                            <div className="text-sm text-gray-400">
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
        </div>
    );
};

export default EmployerDashboard;
