const JobAlert = require('../models/jobAlertModel');

// Create a new job alert
const createJobAlert = async (req, res) => {
  try {
    const { keywords, categories, locations, frequency } = req.body;

    if (frequency && !['daily', 'weekly'].includes(frequency)) {
      return res.status(400).json({ message: "Frequency must be 'daily' or 'weekly'" });
    }

    const jobAlert = await JobAlert.create({
      userId: req.user._id,
      keywords: keywords || [],
      categories: categories || [],
      locations: locations || [],
      frequency: frequency || 'daily',
      isActive: true,
      lastSent: new Date() // Start tracking from creation time onwards
    });

    res.status(201).json(jobAlert);
  } catch (error) {
    console.error('Error creating job alert:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Get all job alerts for the authenticated user
const getMyJobAlerts = async (req, res) => {
  try {
    const alerts = await JobAlert.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching job alerts:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Update a job alert
const updateJobAlert = async (req, res) => {
  try {
    const alertId = req.params.id;
    const { keywords, categories, locations, frequency, isActive } = req.body;

    const alert = await JobAlert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ message: 'Job alert not found' });
    }

    if (alert.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this job alert' });
    }

    if (frequency && !['daily', 'weekly'].includes(frequency)) {
      return res.status(400).json({ message: "Frequency must be 'daily' or 'weekly'" });
    }

    if (keywords !== undefined) alert.keywords = keywords;
    if (categories !== undefined) alert.categories = categories;
    if (locations !== undefined) alert.locations = locations;
    if (frequency !== undefined) alert.frequency = frequency;
    if (isActive !== undefined) alert.isActive = isActive;

    const updatedAlert = await alert.save();
    res.json(updatedAlert);
  } catch (error) {
    console.error('Error updating job alert:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Delete a job alert
const deleteJobAlert = async (req, res) => {
  try {
    const alertId = req.params.id;

    const alert = await JobAlert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ message: 'Job alert not found' });
    }

    if (alert.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this job alert' });
    }

    await JobAlert.deleteOne({ _id: alertId });
    res.json({ message: 'Job alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting job alert:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  createJobAlert,
  getMyJobAlerts,
  updateJobAlert,
  deleteJobAlert
};
