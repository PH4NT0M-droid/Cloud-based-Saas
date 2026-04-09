process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.DATABASE_URL = 'postgresql://ota_user:ota_password@localhost:5432/ota_channel_manager?schema=public';
