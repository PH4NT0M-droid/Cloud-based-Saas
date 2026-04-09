const env = require('../config/env');

const uploadPropertyImage = async ({ propertyId, fileName }) => {
  // Stub for future AWS SDK integration while keeping API contract stable.
  const key = `properties/${propertyId}/${Date.now()}-${fileName}`;
  const url = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

  return {
    bucket: env.AWS_S3_BUCKET,
    region: env.AWS_REGION,
    key,
    url,
  };
};

module.exports = {
  uploadPropertyImage,
};
