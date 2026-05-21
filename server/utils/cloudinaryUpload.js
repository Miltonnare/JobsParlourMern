const { cloudinary, assertCloudinaryConfig } = require('../config/cloudinary');

const uploadBufferToCloudinary = (file, options = {}) => {
  assertCloudinaryConfig();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'jobs-parlour',
        resource_type: options.resourceType || 'auto',
        public_id: options.publicId,
        use_filename: true,
        unique_filename: true,
        overwrite: false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
};

module.exports = { uploadBufferToCloudinary };
