import axios, { AxiosHeaders } from 'axios';
import { getToken, logout } from './auth';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function isApiRequest(url?: string, baseURL?: string) {
  const full = url && /^https?:\/\//.test(url) ? url : `${baseURL ?? ''}${url ?? ''}`;
  return full.startsWith(API_URL);
}

// Interceptors no axios global, para cobrir SWR e todas as chamadas diretas. O token só
// vai para a nossa API — nunca para serviços externos (ex.: cotação do dólar).
const INSTALLED = Symbol.for('agape.axiosAuthInterceptors');
const globalFlags = globalThis as unknown as Record<symbol, boolean>;

if (typeof window !== 'undefined' && !globalFlags[INSTALLED]) {
  globalFlags[INSTALLED] = true;

  axios.interceptors.request.use(config => {
    const token = getToken();
    if (token && isApiRequest(config.url, config.baseURL)) {
      const headers = AxiosHeaders.from(config.headers);
      headers.set('Authorization', `Bearer ${token}`);
      config.headers = headers;
    }
    return config;
  });

  axios.interceptors.response.use(
    response => response,
    error => {
      const cfg = error?.config;
      const isLogin = typeof cfg?.url === 'string' && cfg.url.endsWith('/login');
      if (axios.isAxiosError(error) && error.response?.status === 401 && !isLogin && isApiRequest(cfg?.url, cfg?.baseURL)) {
        logout('expired');
      }
      return Promise.reject(error);
    }
  );
}

// Retorno `any` preserva o comportamento dos useSWR sem tipo explícito nas páginas;
// quem precisa de tipo usa useSWR<Tipo>(...).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetcher = (url: string): Promise<any> => axios.get(url).then(res => res.data);

/**
 * Mensagem amigável para um erro de requisição. O backend só devolve mensagens seguras
 * (validação, "Umbler indisponível", etc.); erros 500 viram o texto de `fallback`.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  const { status, data } = error.response;
  const message = typeof (data as { error?: unknown })?.error === 'string' ? (data as { error: string }).error : null;
  if (message && (status < 500 || status === 502)) return message;
  return fallback;
}

/** true quando o erro veio de falha/timeout da Umbler (HTTP 502 do backend). */
export function isUmblerUnavailable(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 502;
}

function filenameFromDisposition(header?: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) return decodeURIComponent(utf8[1]);
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}

/**
 * Baixa um arquivo da API com o token de acesso. Links diretos (<a href> / window.open)
 * não enviam o cabeçalho Authorization, por isso o download passa pelo axios.
 */
export async function downloadFile(url: string, fallbackName: string) {
  const res = await axios.get<Blob>(url, { responseType: 'blob' });
  const name = filenameFromDisposition(res.headers['content-disposition']) || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
