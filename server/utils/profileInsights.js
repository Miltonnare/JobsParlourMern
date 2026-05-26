const unique = (items = []) => [...new Set(items.filter(Boolean))];

const normalizeSkills = (skills = []) => unique(
  skills
    .flatMap((skill) => String(skill).split(','))
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 1)
);

const parseResumeText = (resumeText = '') => {
  const text = String(resumeText || '').trim();
  const emailMatches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const phoneMatches = text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3}[\s-]?\d{3,4}[\s-]?\d{0,4}/g) || [];
  const linkMatches = text.match(/https?:\/\/[^\s]+|linkedin\.com\/[^\s]+|github\.com\/[^\s]+/gi) || [];
  const skillHints = [
    'javascript', 'typescript', 'react', 'node', 'express', 'mongodb', 'sql', 'python', 'java',
    'aws', 'docker', 'kubernetes', 'figma', 'product', 'sales', 'marketing', 'design', 'leadership'
  ];

  const lower = text.toLowerCase();
  const matchedSkills = skillHints.filter((skill) => lower.includes(skill));
  const summary = text.split(/\n+/).map((line) => line.trim()).find(Boolean) || text.slice(0, 180);

  return {
    skills: unique(matchedSkills),
    emails: unique(emailMatches),
    phones: unique(phoneMatches.map((phone) => phone.trim()).filter((phone) => phone.length >= 7)),
    links: unique(linkMatches),
    summary: summary.slice(0, 240),
    lastParsedAt: new Date()
  };
};

const calculateProfileCompleteness = (profile) => {
  const isEmployer = profile.role === 'employer';
  const checks = isEmployer
    ? {
        name: Boolean(profile.name),
        email: Boolean(profile.email),
        companyName: Boolean(profile.companyName),
        companyWebsite: Boolean(profile.companyWebsite),
        industry: Boolean(profile.industry),
        companyDescription: Boolean(profile.companyDescription),
        companyLogo: Boolean(profile.companyLogo)
      }
    : {
        name: Boolean(profile.name),
        email: Boolean(profile.email),
        bio: Boolean(profile.bio),
        skills: Array.isArray(profile.skills) && profile.skills.length > 0,
        education: Boolean(profile.education),
        experience: Boolean(profile.experience),
        resumeUrl: Boolean(profile.resumeUrl),
        resumeText: Boolean(profile.resumeText)
      };

  const total = Object.keys(checks).length || 1;
  const completed = Object.values(checks).filter(Boolean).length;

  return {
    score: Math.round((completed / total) * 100),
    completed,
    total,
    breakdown: checks
  };
};

const syncProfileInsights = (currentUser, source = 'profile') => {
  const normalizedSkills = normalizeSkills(currentUser.skills || []);
  currentUser.skills = normalizedSkills;

  if (currentUser.resumeText) {
    currentUser.parsedResume = {
      ...parseResumeText(currentUser.resumeText),
      source
    };

    if (!currentUser.skills.length && currentUser.parsedResume.skills.length) {
      currentUser.skills = currentUser.parsedResume.skills;
    }
  }

  const completeness = calculateProfileCompleteness(currentUser);
  currentUser.profileCompletenessScore = completeness.score;
  currentUser.profileCompletenessBreakdown = completeness.breakdown;

  return completeness;
};

module.exports = {
  parseResumeText,
  calculateProfileCompleteness,
  syncProfileInsights
};
