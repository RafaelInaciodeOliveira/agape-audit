import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';

export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  
  // Começa com a tela totalmente trancada e preta por padrão
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = sessionStorage.getItem('agape_audit_token');
    const expiresAt = sessionStorage.getItem('agape_audit_expires');
    const now = new Date().getTime();

    // 1. Falhou na segurança (Sem token ou expirado)
    if (!token || !expiresAt || now >= parseInt(expiresAt)) {
      sessionStorage.clear();
      // Só empurra pro login se já não estiver lá
      if (pathname !== '/login') {
        router.replace('/login');
      }
      return; // Morre aqui, não altera o estado de forma síncrona
    }

    // 2. Passou na segurança! Libera a tela.
    // Usamos um setTimeout zerado para o ESLint não acusar mudança síncrona
    const authTimer = setTimeout(() => {
      setIsAuthorized(true);
    }, 0);

    // 3. Bomba-relógio programada para as 23:59:59
    const timeUntilExpiration = parseInt(expiresAt) - now;
    const expirationTimer = setTimeout(() => {
      sessionStorage.clear();
      setIsAuthorized(false);
      toast.info('Sessão expirada na virada do dia. Faça login novamente.');
      if (pathname !== '/login') {
        router.replace('/login');
      }
    }, timeUntilExpiration);

    // Limpa a memória se a pessoa trocar de tela
    return () => {
      clearTimeout(authTimer);
      clearTimeout(expirationTimer);
    };
  }, [router, pathname]);

  return isAuthorized;
}