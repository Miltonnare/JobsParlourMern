const express = require('express');
const {
  sendMessage,
  getConversations,
  getConversationThread,
  markConversationRead
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');
const { requireEmployerCapability } = require('../middleware/capabilityMiddleware');
const { validate, idField, stringField } = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(protect, restrictTo('employer', 'jobseeker'));
router.get('/', getConversations);
router.post('/', (req, res, next) => {
  if (req.user.role === 'employer') {
    return requireEmployerCapability('messages.send')(req, res, next);
  }
  next();
}, validate({
  body:[
    idField('receiverId',{required:true,label:'receiver id'}),
    idField('jobId',{required:true,label:'job id'}),
    stringField('content',{required:true,minLength:1,maxLength:5000})
  ]
}), sendMessage);
router.get('/:jobId/:participantId', validate({
  params:[
    idField('jobId',{required:true,label:'job id'}),
    idField('participantId',{required:true,label:'participant id'})
  ]
}), getConversationThread);
router.patch('/:jobId/:participantId/read', validate({
  params:[
    idField('jobId',{required:true,label:'job id'}),
    idField('participantId',{required:true,label:'participant id'})
  ]
}), markConversationRead);

module.exports = router;
