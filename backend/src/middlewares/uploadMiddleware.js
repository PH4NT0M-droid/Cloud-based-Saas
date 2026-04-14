const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    callback(new Error('Only image uploads are allowed'));
    return;
  }

  callback(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});

const uploadPropertyLogo = upload.single('propertyLogo');

module.exports = {
  uploadPropertyLogo,
};