const JobAlert = require('../models/jobAlertModel');
const Job = require('../models/jobModel');

const buildAlertPayload = (body = {}) => ({
  name: body.name || '',
  keywords: Array.isArray(body.keywords) ? body.keywords : [],
  categories: Array.isArray(body.categories) ? body.categories : [],
  locations: Array.isArray(body.locations) ? body.locations : [],
  frequency: body.frequency || 'daily',
  isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
  alertEnabled: body.alertEnabled !== undefined ? Boolean(body.alertEnabled) : true
});

const buildQueryFromSearch = (search) => {
  const query = { status: 'active' };
  const conditions = [];

  if (search.keywords?.length) {
    conditions.push({
      $or: search.keywords.map((keyword) => ({
        $or: [
          { title: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ]
      }))
    });
  }

  if (search.categories?.length) {
    conditions.push({
      $or: search.categories.map((category) => ({ jobType: { $regex: category, $options: 'i' } }))
    });
  }

  if (search.locations?.length) {
    conditions.push({
      $or: search.locations.map((location) => ({ location: { $regex: location, $options: 'i' } }))
    });
  }

  if (conditions.length) query.$and = conditions;
  return query;
};

const createSavedSearch = async (req, res) => {
  const savedSearch = await JobAlert.create({
    userId: req.user._id,
    ...buildAlertPayload(req.body)
  });

  res.status(201).json(savedSearch);
};

const getSavedSearches = async (req, res) => {
  const searches = await JobAlert.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json(searches);
};

const updateSavedSearch = async (req, res) => {
  const search = await JobAlert.findOne({ _id: req.params.id, userId: req.user._id });
  if (!search) return res.status(404).json({ message: 'Saved search not found' });

  Object.assign(search, buildAlertPayload({ ...search.toObject(), ...req.body }));
  await search.save();

  res.json(search);
};

const deleteSavedSearch = async (req, res) => {
  const deleted = await JobAlert.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!deleted) return res.status(404).json({ message: 'Saved search not found' });
  res.json({ message: 'Saved search deleted successfully' });
};

const previewSavedSearchMatches = async (req, res) => {
  const search = await JobAlert.findOne({ _id: req.params.id, userId: req.user._id });
  if (!search) return res.status(404).json({ message: 'Saved search not found' });

  const query = buildQueryFromSearch(search);
  const jobs = await Job.find(query)
    .populate('createdBy', 'name companyName companyLogo industry')
    .sort({ createdAt: -1 })
    .limit(20);

  search.lastMatchedCount = jobs.length;
  await search.save();

  res.json({
    savedSearch: search,
    totalMatches: jobs.length,
    jobs
  });
};

module.exports = {
  createSavedSearch,
  getSavedSearches,
  updateSavedSearch,
  deleteSavedSearch,
  previewSavedSearchMatches
};
