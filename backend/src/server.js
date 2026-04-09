const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');
const { ensureDefaultAdmin } = require('./services/authService');

const startServer = async () => {
  await ensureDefaultAdmin();

  const server = app.listen(env.PORT, () => {
    console.log(`Backend running on port ${env.PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down gracefully.`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});
