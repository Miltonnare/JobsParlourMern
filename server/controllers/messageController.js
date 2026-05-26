const Message = require('../models/messageModel');
const Job = require('../models/jobModel');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');
const { getBillingOwnerId } = require('../middleware/subscriptionMiddleware');

const buildConversationKey = ({ jobId, userA, userB }) => [String(jobId), String(userA), String(userB)].sort().join(':');

const assertMessagingAccess = async ({ sender, receiverId, jobId }) => {
  const job = await Job.findById(jobId);
  if (!job) {
    const error = new Error('Job not found');
    error.statusCode = 404;
    throw error;
  }

  const receiver = await User.findById(receiverId).select('_id role companyId name email');
  if (!receiver) {
    const error = new Error('Receiver not found');
    error.statusCode = 404;
    throw error;
  }

  const companyId = job.createdBy.toString();
  const senderCompanyId = getBillingOwnerId(sender).toString();
  const receiverCompanyId = receiver.role === 'employer' ? getBillingOwnerId(receiver).toString() : null;
  const application = job.applications.find((item) => item.user?.toString() === sender._id.toString() || item.user?.toString() === receiver._id.toString());

  const senderIsCompany = sender.role === 'employer' && senderCompanyId === companyId;
  const receiverIsCompany = receiver.role === 'employer' && receiverCompanyId === companyId;
  const senderIsApplicant = application && application.user.toString() === sender._id.toString();
  const receiverIsApplicant = application && application.user.toString() === receiver._id.toString();

  const validPair = (senderIsCompany && receiverIsApplicant) || (receiverIsCompany && senderIsApplicant);
  if (!validPair) {
    const error = new Error('Messaging is only allowed between the employer team and an applicant for the same job');
    error.statusCode = 403;
    throw error;
  }

  return { job, receiver, application };
};

const sendMessage = async (req, res) => {
  try {
    const { receiverId, jobId, content } = req.body;
    if (!receiverId || !jobId || !content) {
      return res.status(400).json({ message: 'receiverId, jobId, and content are required' });
    }

    const { job, receiver, application } = await assertMessagingAccess({
      sender: req.user,
      receiverId,
      jobId
    });

    const conversationKey = buildConversationKey({
      jobId,
      userA: req.user._id,
      userB: receiver._id
    });

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiver._id,
      companyId: job.createdBy,
      jobId: job._id,
      applicationId: application?._id,
      conversationKey,
      content
    });

    await Notification.create({
      user: receiver._id,
      type: 'message',
      message: `New message from ${req.user.name} about ${job.title}`
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to send message' });
  }
};

const getConversations = async (req, res) => {
  const messages = await Message.find({
    $or: [{ sender: req.user._id }, { receiver: req.user._id }]
  })
    .populate('sender', 'name role companyName employerRole')
    .populate('receiver', 'name role companyName employerRole')
    .populate('jobId', 'title status')
    .sort({ createdAt: -1 });

  const conversations = [];
  const seen = new Set();

  messages.forEach((message) => {
    if (seen.has(message.conversationKey)) return;
    seen.add(message.conversationKey);
    conversations.push(message);
  });

  res.json(conversations);
};

const getConversationThread = async (req, res) => {
  const { jobId, participantId } = req.params;
  const conversationKey = buildConversationKey({
    jobId,
    userA: req.user._id,
    userB: participantId
  });

  const thread = await Message.find({ conversationKey })
    .populate('sender', 'name role companyName employerRole')
    .populate('receiver', 'name role companyName employerRole')
    .sort({ createdAt: 1 });

  res.json(thread);
};

const markConversationRead = async (req, res) => {
  const { jobId, participantId } = req.params;
  const conversationKey = buildConversationKey({
    jobId,
    userA: req.user._id,
    userB: participantId
  });

  await Message.updateMany(
    { conversationKey, receiver: req.user._id, read: false },
    { read: true, readAt: new Date() }
  );

  res.json({ message: 'Conversation marked as read' });
};

module.exports = {
  sendMessage,
  getConversations,
  getConversationThread,
  markConversationRead
};
