import axios from 'axios';

/**
 * Registra um erro sem dados de clientes (LGPD): só contexto, mensagem técnica,
 * status HTTP e stack. Nunca loga `response.data`, `config` (que traz headers com
 * token e parâmetros) nem payloads de mensagens.
 */
export function logError(context: string, err: unknown) {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 'sem resposta';
    console.error(`[${context}] ${err.message} (HTTP ${status}, ${err.code ?? 'sem código'})`);
    return;
  }
  if (err instanceof Error) {
    console.error(`[${context}] ${err.name}: ${err.message}`);
    if (err.stack) console.error(err.stack);
    return;
  }
  console.error(`[${context}] Erro desconhecido`);
}
