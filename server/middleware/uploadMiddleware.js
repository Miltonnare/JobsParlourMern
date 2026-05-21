const multer = require('multer');

const storage = multer.memoryStorage();

const resumeFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  cb(null, allowedTypes.includes(file.mimetype));
};

const imageFileFilter = (req, file, cb) => {
  cb(null, file.mimetype.startsWith('image/'));
};

const uploadResume = multer({
  storage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024
  }
});

const uploadAnyFile = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

module.exports = { uploadResume, uploadImage, uploadAnyFile };
