const express = require('express');
const {
  createJobAlert,
  getMyJobAlerts,
  updateJobAlert,
  deleteJobAlert
} = require('../controllers/jobAlertController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');

const router = express.Router();

// All job alert routes are protected and restricted to jobseekers
router.use(protect);
router.use(restrictTo('jobseeker'));

router.route('/')
  .post(createJobAlert)
  .get(getMyJobAlerts);

router.route('/:id')
  .put(updateJobAlert)
  .delete(deleteJobAlert);

module.exports = router;
