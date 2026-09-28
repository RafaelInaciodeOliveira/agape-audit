const TOKEN_KEY = 'agape_audit_token';
const LEGACY_KEYS = ['agape_audit_token', 'agape_audit_expires'];

interface JwtClaims {
  sub?: string;
  exp?: number;
}

function decodeClaims(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  // Resquício do login antigo (token fixo em sessionStorage).
  LEGACY_KEYS.forEach(k => sessionStorage.removeItem(k));
}

/** Expiração do token em ms (epoch), ou null se o token não existir ou for ilegível. */
export function getTokenExpiry(token = getToken()): number | null {
  if (!token) return null;
  const exp = decodeClaims(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

// Checagem apenas de UX (evita mostrar telas com sessão vencida). Quem garante a
// segurança é o backend, que valida a assinatura do JWT em toda requisição.
export function hasValidToken(): boolean {
  const expiry = getTokenExpiry();
  return expiry !== null && expiry > Date.now();
}

export function logout(reason?: 'expired') {
  clearToken();
  if (typeof window === 'undefined') return;
  const target = reason === 'expired' ? '/login?expired=1' : '/login';
  if (window.location.pathname !== '/login') window.location.replace(target);
}
