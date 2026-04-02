export default () => {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = process.env.REDIS_PORT || '6379';
  const redisUsername = process.env.REDIS_USERNAME || 'default';
  const redisPassword = process.env.REDIS_PASSWORD || '';

  return {
    port: parseInt(process.env.PORT || '3000', 10) || 3000,
    database: {
      url: process.env.DATABASE_URL,
      mongoUri: process.env.MONGODB_URI,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || '6379',
      username: process.env.REDIS_USERNAME || 'default',
      password: process.env.REDIS_PASSWORD || '',
    },
    frontendUrl: process.env.FRONTEND_URL,
  };
};
