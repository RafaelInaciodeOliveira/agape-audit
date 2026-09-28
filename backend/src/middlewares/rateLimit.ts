import rateLimit from 'express-rate-limit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

// Limita tentativas de login por IP. Logins bem-sucedidos não contam, então só
// quem erra a senha repetidamente é bloqueado.
export const loginRateLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_MAX_ATTEMPTS,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    const resetTime = (req as { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(options.windowMs / 1000);
    const minutes = Math.ceil(retryAfterSeconds / 60);
    res.status(429).json({
      error: `Muitas tentativas de login. Acesso bloqueado temporariamente; tente novamente em ${minutes} minuto(s).`,
      retryAfterSeconds,
    });
  },
});
