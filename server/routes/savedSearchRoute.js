const express = require('express');
const {
  createSavedSearch,
  getSavedSearches,
  updateSavedSearch,
  deleteSavedSearch,
  previewSavedSearchMatches
} = require('../controllers/savedSearchController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');
const { enforcePlanLimit } = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(protect, restrictTo('jobseeker'));
router.get('/', getSavedSearches);
router.post('/', enforcePlanLimit('save_search'), createSavedSearch);
router.get('/:id/preview', previewSavedSearchMatches);
router.put('/:id', updateSavedSearch);
router.delete('/:id', deleteSavedSearch);

module.exports = router;
