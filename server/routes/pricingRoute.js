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
const { requireBillingAccess } = require('../middleware/capabilityMiddleware');
const { validate, idField, stringField, numberField, objectField, arrayField, booleanField } = require('../middleware/validationMiddleware');

const router = express.Router();

router.get('/plans', getPricingPlans);
router.post('/plans/seed', protect, restrictTo('admin'), seedPricingPlans);
router.post('/plans', protect, restrictTo('admin'), validate({
  body:[
    stringField('name',{required:true,minLength:2,maxLength:120}),
    stringField('slug',{required:true,minLength:2,maxLength:120}),
    stringField('role',{required:true,enum:['employer','jobseeker']}),
    numberField('price',{required:true,min:0}),
    stringField('currency',{required:true,maxLength:10}),
    stringField('interval',{required:true,enum:['free','monthly','yearly','one_time']}),
    stringField('description',{maxLength:2000}),
    arrayField('features'),
    objectField('limits'),
    booleanField('isActive'),
    numberField('sortOrder',{integer:true,min:0})
  ]
}), createPricingPlan);
router.put('/plans/:id', protect, restrictTo('admin'), validate({
  params:[idField('id',{required:true,label:'pricing plan id'})]
}), updatePricingPlan);
router.get('/subscription/me', protect, getMySubscription);
router.post('/subscription/free/:planId', protect, requireBillingAccess, validate({
  params:[idField('planId',{required:true,label:'plan id'})]
}), activateFreePlan);
router.post('/subscription/change-plan', protect, requireBillingAccess, validate({
  body:[idField('planId',{required:true,label:'plan id'})]
}), changeSubscriptionPlan);
router.post('/subscription/cancel', protect, requireBillingAccess, cancelSubscription);

module.exports = router;
