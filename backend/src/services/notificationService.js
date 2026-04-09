const prisma = require('../config/prisma');

const sendEmailSimulation = async ({ to, subject, message }) => {
  console.log(`[EMAIL SIMULATION] to=${to || 'ops@local'} subject=${subject} message=${message}`);
  return { delivered: true };
};

const createInAppNotification = async ({ type, message }) => {
  return prisma.notification.create({
    data: {
      type,
      message,
    },
  });
};

const notify = async ({ type, message, email }) => {
  await Promise.all([
    sendEmailSimulation({ to: email, subject: `OTA Alert: ${type}`, message }),
    createInAppNotification({ type, message }),
  ]);
};

module.exports = {
  notify,
  sendEmailSimulation,
  createInAppNotification,
};
