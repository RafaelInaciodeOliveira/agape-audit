import { Router, Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { signAuthToken, getJwtSecret } from '../middlewares/authMiddleware.js';

const router = Router();

// Compara em tempo constante (o hash iguala os tamanhos antes do timingSafeEqual).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};
  const envUser = process.env.ADMIN_USER;
  const envPass = process.env.ADMIN_PASS;

  if (!envUser || !envPass || !getJwtSecret()) {
    console.error('[Auth] ADMIN_USER, ADMIN_PASS ou JWT_SECRET não configurados no backend/.env.');
    return res.status(500).json({ error: 'Login não configurado no servidor.' });
  }

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

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
