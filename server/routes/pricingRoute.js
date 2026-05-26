const express = require('express');
const {
  getPricingPlans,
  seedPricingPlans,
  createPricingPlan,
  updatePricingPlan,
  getMySubscription,
  activateFreePlan,
  changeSubscriptionPlan,
  cancelSubscription
} = require('../controllers/pricingController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/plans', getPricingPlans);
router.post('/plans/seed', protect, restrictTo('admin'), seedPricingPlans);
router.post('/plans', protect, restrictTo('admin'), createPricingPlan);
router.put('/plans/:id', protect, restrictTo('admin'), updatePricingPlan);
router.get('/subscription/me', protect, getMySubscription);
router.post('/subscription/free/:planId', protect, activateFreePlan);
router.post('/subscription/change-plan', protect, changeSubscriptionPlan);
router.post('/subscription/cancel', protect, cancelSubscription);

module.exports = router;
