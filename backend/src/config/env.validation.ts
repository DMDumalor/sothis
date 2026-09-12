import * as Joi from 'joi';

/**
 * Fails startup fast and loudly if a required environment variable is
 * missing or malformed, per spec section 52 ("If a required environment
 * variable is missing, fail clearly.").
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: Joi.number().default(7),

  ACCOUNT_LOCKOUT_MAX_ATTEMPTS: Joi.number().default(5),
  ACCOUNT_LOCKOUT_MINUTES: Joi.number().default(15),
  INVITATION_EXPIRES_IN_DAYS: Joi.number().default(7),

  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
  API_URL: Joi.string().uri().default('http://localhost:3000'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),

  SENTRY_DSN: Joi.string().allow('').optional(),

  THROTTLE_TTL_SECONDS: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),
  LOGIN_THROTTLE_LIMIT: Joi.number().default(10),
});
