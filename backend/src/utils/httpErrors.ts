import type { Response } from 'express';
import axios from 'axios';
import { logError } from './logger.js';

const GENERIC_MESSAGE = 'Ocorreu um erro interno no servidor.';
const UMBLER_MESSAGE = 'Não foi possível se comunicar com a Umbler. Tente novamente em instantes.';
const UMBLER_TIMEOUT_MESSAGE = 'A Umbler demorou demais para responder. Tente novamente em instantes.';

/**
 * Falha em uma chamada à API da Umbler (queda, timeout, resposta de erro). Criado pelo
 * interceptor do client HTTP da Umbler, para as rotas saberem que o problema é externo.
 * A mensagem traz só método, caminho e status — sem query string, headers ou corpo.
 */
export class UmblerError extends Error {
  readonly status?: number;
  readonly timeout: boolean;

  constructor(message: string, opts: { status?: number; timeout?: boolean; cause?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = 'UmblerError';
    this.status = opts.status;
    this.timeout = opts.timeout ?? false;
  }

  static fromAxios(err: unknown): UmblerError {
    if (err instanceof UmblerError) return err;
    if (!axios.isAxiosError(err)) return new UmblerError(`Umbler: ${err instanceof Error ? err.message : 'erro desconhecido'}`, { cause: err });
    const method = (err.config?.method || 'get').toUpperCase();
    const path = err.config?.url || '';
    const timeout = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
    const status = err.response?.status;
    const detail = timeout ? `timeout (${err.config?.timeout ?? '?'}ms)` : status ? `HTTP ${status}` : err.code || err.message;
    return new UmblerError(`Umbler ${method} ${path}: ${detail}`, { status, timeout, cause: err });
  }
}

/**
 * Responde um erro sem vazar detalhes internos: o erro completo vai para o log e o
 * cliente recebe só uma mensagem genérica. Falhas da Umbler viram 502 (Bad Gateway).
 */
export function sendError(res: Response, err: unknown, context: string, publicMessage = GENERIC_MESSAGE) {
  logError(context, err);
  if (res.headersSent) return;
  if (err instanceof UmblerError) {
    return res.status(502).json({
      error: err.timeout ? UMBLER_TIMEOUT_MESSAGE : UMBLER_MESSAGE,
      code: err.timeout ? 'UMBLER_TIMEOUT' : 'UMBLER_UNAVAILABLE',
    });
  }
  return res.status(500).json({ error: publicMessage, code: 'INTERNAL_ERROR' });
}
