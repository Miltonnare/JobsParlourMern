const { Types } = require('mongoose');
const { uploadBufferToCloudinary } = require('./cloudinaryUpload');
const { extractResumeTextFromFile } = require('./resumeParsing');
const { parseResumeText } = require('./profileInsights');

const createEmptyParsedResume = (source = '') => ({
  skills: [],
  emails: [],
  phones: [],
  links: [],
  summary: '',
  lastParsedAt: new Date(),
  source
});

const createIdleResumeParsing = () => ({
  status: 'idle',
  failureReason: '',
  warning: '',
  sourceFileName: '',
  mimeType: '',
  extractedCharacters: 0,
  lastAttemptedAt: new Date()
});

const buildResumeRecordFromUpload = async ({
  file,
  ownerId,
  folderSuffix = 'resumes',
  manualResumeText = '',
  label = ''
}) => {
  if (!file) {
    throw new Error('Resume file is required');
  }

  const upload = await uploadBufferToCloudinary(file, {
    folder: `jobs-parlour/${ownerId}/${folderSuffix}`,
    resourceType: 'raw'
  });

  let extractedResume = { text: '', strategy: 'upload', status: 'needs_review', warning: '' };
  try {
    extractedResume = await extractResumeTextFromFile(file);
  } catch (parseError) {
    extractedResume = {
      text: '',
      strategy: 'upload',
      status: 'failed',
      warning: '',
      failureReason: parseError.message
    };
  }

  const trimmedManualResumeText = typeof manualResumeText === 'string' ? manualResumeText.trim() : '';
  const finalResumeText = trimmedManualResumeText || extractedResume.text || '';
  const parsingSource = trimmedManualResumeText ? 'manual_upload_override' : extractedResume.strategy;

  return {
    _id: new Types.ObjectId(),
    label: (label || file.originalname || 'Resume').trim(),
    resumeUrl: upload.secure_url,
    resumeText: finalResumeText,
    parsedResume: finalResumeText
      ? {
          ...parseResumeText(finalResumeText),
          source: parsingSource
        }
      : createEmptyParsedResume(parsingSource),
    resumeParsing: {
      status: trimmedManualResumeText ? 'parsed' : extractedResume.status,
      failureReason: extractedResume.failureReason || '',
      warning: trimmedManualResumeText ? '' : (extractedResume.warning || ''),
      sourceFileName: file.originalname || '',
      mimeType: file.mimetype || '',
      extractedCharacters: finalResumeText.length,
      lastAttemptedAt: new Date()
    },
    isPrimary: false,
    uploadedAt: new Date(),
    publicId: upload.public_id,
    resourceType: upload.resource_type
  };
};

const syncPrimaryResumeFields = (currentUser, resumeRecord) => {
  if (!resumeRecord) {
    currentUser.resumeUrl = '';
    currentUser.resumeText = '';
    currentUser.parsedResume = createEmptyParsedResume('resume_cleared');
    currentUser.resumeParsing = createIdleResumeParsing();
    return;
  }

  currentUser.resumeUrl = resumeRecord.resumeUrl || '';
  currentUser.resumeText = resumeRecord.resumeText || '';
  currentUser.parsedResume = resumeRecord.parsedResume || createEmptyParsedResume('resume_record');
  currentUser.resumeParsing = resumeRecord.resumeParsing || createIdleResumeParsing();
};

const ensureSinglePrimaryResume = (currentUser, primaryResumeId) => {
  currentUser.resumes = currentUser.resumes || [];
  currentUser.resumes.forEach((resume) => {
    resume.isPrimary = String(resume._id) === String(primaryResumeId);
  });

  const primaryResume = currentUser.resumes.find((resume) => resume.isPrimary)
    || currentUser.resumes[0]
    || null;

  if (primaryResume && !primaryResume.isPrimary) {
    primaryResume.isPrimary = true;
  }

  syncPrimaryResumeFields(currentUser, primaryResume);
  return primaryResume;
};

module.exports = {
  buildResumeRecordFromUpload,
  createEmptyParsedResume,
  createIdleResumeParsing,
  syncPrimaryResumeFields,
  ensureSinglePrimaryResume
};
