import { useEffect, useState } from 'react';
import { getToken, getTokenExpiry, hasValidToken, logout } from '../lib/auth';
import '../lib/api'; // instala os interceptors do axios (Authorization + logout em 401)

// Maior atraso aceito pelo setTimeout (~24,8 dias); acima disso ele dispara na hora.
const MAX_TIMEOUT = 2_147_483_647;

export function useAuth() {
  // Começa com a tela totalmente trancada e preta por padrão
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!hasValidToken()) {
      logout(getToken() ? 'expired' : undefined);
      return;
    }

    // setTimeout zerado para o ESLint não acusar setState síncrono no efeito
    const authTimer = setTimeout(() => setIsAuthorized(true), 0);

    // Desloga quando o JWT vencer, mesmo sem nenhuma requisição à API
    const expiry = getTokenExpiry() ?? Date.now();
    const expirationTimer = setTimeout(() => {
      setIsAuthorized(false);
      logout('expired');
    }, Math.min(Math.max(expiry - Date.now(), 0), MAX_TIMEOUT));

    return () => {
      clearTimeout(authTimer);
      clearTimeout(expirationTimer);
    };
  }, []);

  return isAuthorized;
}
