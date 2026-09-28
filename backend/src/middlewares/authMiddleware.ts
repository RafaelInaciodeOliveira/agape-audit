import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export const JWT_EXPIRES_IN = '1d';
const JWT_ALGORITHM = 'HS256';

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthTokenPayload;
  }
}

export function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export function signAuthToken(username: string): { token: string; expiresAt: number } {
  const secret = getJwtSecret();
  if (!secret) throw new Error('JWT_SECRET não configurado (mínimo de 32 caracteres).');
  const token = jwt.sign({}, secret, { subject: username, expiresIn: JWT_EXPIRES_IN, algorithm: JWT_ALGORITHM });
  const { exp } = jwt.decode(token) as JwtPayload;
  return { token, expiresAt: (exp as number) * 1000 };
}

// Exige "Authorization: Bearer <token>" com um JWT válido assinado com JWT_SECRET.
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const secret = getJwtSecret();
  if (!secret) {
    console.error('[Auth] JWT_SECRET ausente ou curto demais; bloqueando requisições autenticadas.');
    return res.status(500).json({ error: 'Autenticação não configurada no servidor.' });
  }

  const header = req.headers.authorization;
  const [scheme, token] = header?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token de acesso ausente.' });
  }

  try {
    const payload = jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] });
    if (typeof payload === 'string' || !payload.sub) {
      return res.status(401).json({ error: 'Token de acesso inválido.' });
    }
    req.user = payload as AuthTokenPayload;
    return next();
  } catch (err) {
    const expired = err instanceof jwt.TokenExpiredError;
    return res.status(401).json({ error: expired ? 'Sessão expirada.' : 'Token de acesso inválido.' });
  }
}
