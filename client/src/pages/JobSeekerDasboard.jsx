import { useEffect, useState } from "react";
import axios from 'axios';
import JobItem from '../components/JobItem';

const JobSeekerDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registrationWarning, setRegistrationWarning] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedWorkplace, setSelectedWorkplace] = useState('all');
  const [sort, setSort] = useState('newest');
  const [minSalary, setMinSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [savedIds, setSavedIds] = useState([]);

  const fetchJobs = async () => {
    try {
      const params = {
        search: searchTerm,
        jobType: selectedType,
        location: selectedLocation,
        workplace: selectedWorkplace,
        minSalary,
        maxSalary,
        sort,
        page,
        limit: 9
      };
      const res = await axios.get(import.meta.env.VITE_REACT_APP_JOBS_URL, { params });
      const jobsData = Array.isArray(res.data) ? res.data : res.data.jobs;
      const decoratedJobs = jobsData.map(job => ({ ...job, isSaved: savedIds.includes(job._id) }));
      setJobs(decoratedJobs);
      setFilteredJobs(decoratedJobs);
      setPages(res.data.pages || 1);
    } catch (error) {
      console.error("Failed to Fetch Jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchSavedJobs = async () => {
      if (!localStorage.getItem('user')) return;
      try {
        const auth = JSON.parse(localStorage.getItem('user'));
        if (auth?.user?.role !== 'jobseeker') return;
        const savedRes = await axios.get(
          `${import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '')}/saved-jobs`,
          { headers: { Authorization: `Bearer ${auth.token}` } }
        );
        setSavedIds(savedRes.data.map(job => job._id));
      } catch (error) {
        console.error("Failed to fetch saved jobs:", error);
      }
    };
    fetchSavedJobs();

    const storedWarning = sessionStorage.getItem('registrationWarning');
    if (storedWarning) {
      setRegistrationWarning(storedWarning);
      sessionStorage.removeItem('registrationWarning');
    }
  }, []);

  
  useEffect(() => {
    fetchJobs();
  }, [searchTerm, selectedType, selectedLocation, selectedWorkplace, minSalary, maxSalary, sort, page, savedIds]);

  
  const jobTypes = ['all', ...new Set(jobs.map(job => job.jobType || job.Type).filter(Boolean))];
  const locations = ['all', ...new Set(jobs.map(job => job.location))];

  
  const totalJobs = jobs.length;
  const averageSalary = jobs.length > 0 
    ? Math.round(jobs.reduce((sum, job) => sum + job.salary, 0) / jobs.length)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-orange-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Job Seeker Dashboard</h1>
            <p className="text-xl text-blue-100">Find your dream job from thousands of opportunities</p>
          </div>
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 gap-y-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="text-3xl font-bold mb-2">{totalJobs}</div>
              <div className="text-blue-100">Total Jobs Available</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="text-3xl font-bold mb-2">{filteredJobs.length}</div>
              <div className="text-blue-100">Filtered Results</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="text-3xl font-bold mb-2">KSH {averageSalary.toLocaleString()}</div>
              <div className="text-blue-100">Average Salary</div>
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

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 gap-y-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Jobs</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by title, description, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Job Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {jobTypes.map(type => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Types' : type}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {locations.map(location => (
                  <option key={location} value={location}>
                    {location === 'all' ? 'All Locations' : location}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Workplace</label>
              <select
                value={selectedWorkplace}
                onChange={(e) => { setSelectedWorkplace(e.target.value); setPage(1); }}
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Workplaces</option>
                <option value="onsite">On-site</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="salary-high">Highest salary</option>
                <option value="salary-low">Lowest salary</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Salary</label>
              <input value={minSalary} onChange={(e) => setMinSalary(e.target.value)} type="number" className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Salary</label>
              <input value={maxSalary} onChange={(e) => setMaxSalary(e.target.value)} type="number" className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
        </div>

        {/* Jobs Section */}
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-blue-600">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading jobs...
              </div>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-24 w-24 text-gray-300 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
              <p className="text-gray-500">
                {searchTerm || selectedType !== 'all' || selectedLocation !== 'all' 
                  ? 'Try adjusting your search criteria or filters.'
                  : 'There are currently no jobs available. Check back later!'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Available Jobs ({filteredJobs.length})
                </h2>
                <div className="text-sm text-gray-500">
                  Showing {filteredJobs.length} of {totalJobs} jobs
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 gap-y-4 min-w-0">
                {filteredJobs.map((job, index) => (
                  <JobItem 
                    key={job._id || `job-${index}`} 
                    job={job} 
                    onApplySuccess={() => {
                     
                      fetchJobs();
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-center gap-3 mt-8">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50">Previous</button>
                <span className="text-sm text-gray-600">Page {page} of {pages}</span>
                <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50">Next</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobSeekerDashboard;
