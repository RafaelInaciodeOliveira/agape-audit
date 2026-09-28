import { Router, Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { signAuthToken, getJwtSecret } from '../middlewares/authMiddleware.js';
import { loginRateLimiter } from '../middlewares/rateLimit.js';
import { loginBodySchema, parseInput } from '../validation/schemas.js';

const router = Router();

// Compara em tempo constante (o hash iguala os tamanhos antes do timingSafeEqual).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

router.post('/login', loginRateLimiter, (req: Request, res: Response) => {
  const envUser = process.env.ADMIN_USER;
  const envPass = process.env.ADMIN_PASS;

  if (!envUser || !envPass || !getJwtSecret()) {
    console.error('[Auth] ADMIN_USER, ADMIN_PASS ou JWT_SECRET não configurados no backend/.env.');
    return res.status(500).json({ error: 'Login não configurado no servidor.' });
  }

  const input = parseInput(loginBodySchema, req.body, res);
  if (!input) return;
  const { username, password } = input;

  // Avalia os dois lados sempre, para não revelar pelo tempo qual campo errou.
  const userOk = safeEqual(username, envUser);
  const passOk = safeEqual(password, envPass);
  if (!userOk || !passOk) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  const { token, expiresAt } = signAuthToken(username);
  return res.json({ token, expiresAt });
});

export default router;
