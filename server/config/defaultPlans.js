const DEFAULT_PLANS = [
  {
    name: 'Job Seeker Free',
    slug: 'jobseeker-free',
    role: 'jobseeker',
    description: 'Basic job discovery and applications.',
    price: 0,
    currency: 'USD',
    interval: 'free',
    sortOrder: 1,
    features: ['Browse jobs', 'Save jobs', 'Apply with profile', 'Basic ATS match'],
    limits: { applicationsPerMonth: 10, savedJobs: 25, savedSearches: 10 }
  },
  {
    name: 'Job Seeker Pro',
    slug: 'jobseeker-pro',
    role: 'jobseeker',
    description: 'More applications, bidding, and stronger candidate insights.',
    price: 500,
    currency: 'USD',
    interval: 'monthly',
    sortOrder: 2,
    features: ['Unlimited applications', 'Application bidding', 'Advanced ATS insights', 'Profile boost'],
    limits: { applicationsPerMonth: -1, savedJobs: -1, savedSearches: -1, profileBoosts: 3 }
  },
  {
    name: 'Employer Starter',
    slug: 'employer-starter',
    role: 'employer',
    description: 'Post jobs and manage applicants.',
    price: 1000,
    currency: 'USD',
    interval: 'monthly',
    sortOrder: 1,
    features: ['Post up to 3 jobs', 'Applicant pipeline', 'CSV export', 'Basic ATS sorting'],
    limits: { activeJobs: 3, applicantExports: 5, featuredJobs: 0 }
  },
  {
    name: 'Employer Growth',
    slug: 'employer-growth',
    role: 'employer',
    description: 'Scale hiring with featured jobs and richer applicant tools.',
    price: 3000,
    currency: 'USD',
    interval: 'monthly',
    sortOrder: 2,
    features: ['Unlimited jobs', 'Featured jobs', 'Advanced ATS ranking', 'Priority applicant pipeline'],
    limits: { activeJobs: -1, featuredJobs: 5, applicantExports: -1 }
  }
];

const getDefaultPlanForRole = (role) => DEFAULT_PLANS.find((plan) => plan.role === role && plan.price === 0)
  || DEFAULT_PLANS.find((plan) => plan.role === role);

module.exports = {
  DEFAULT_PLANS,
  getDefaultPlanForRole
};
