export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m',
    refreshExpiresInDays: parseInt(
      process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS ?? '7',
      10,
    ),
  },

  security: {
    lockoutMaxAttempts: parseInt(
      process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS ?? '5',
      10,
    ),
    lockoutMinutes: parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES ?? '15', 10),
    invitationExpiresInDays: parseInt(
      process.env.INVITATION_EXPIRES_IN_DAYS ?? '7',
      10,
    ),
  },

  urls: {
    frontend: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    api: process.env.API_URL ?? 'http://localhost:3000',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim()),
  },

  sentryDsn: process.env.SENTRY_DSN ?? '',

  throttle: {
    ttlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    loginLimit: parseInt(process.env.LOGIN_THROTTLE_LIMIT ?? '10', 10),
  },
});
