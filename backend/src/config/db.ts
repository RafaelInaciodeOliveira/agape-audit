import mongoose from 'mongoose';
import { logError } from '../utils/logger.js';

/** Handle do driver nativo exposto pelo Mongoose (mesma conexão/pool). */
export type Db = NonNullable<typeof mongoose.connection.db>;

let connecting: Promise<Db> | null = null;
let closing = false;

/**
 * Abre a única conexão da aplicação com o MongoDB. Chamadas concorrentes reutilizam a
 * mesma promise, então nunca há dois pools abertos.
 */
export function connectDatabase(uri = process.env.MONGODB_URI): Promise<Db> {
  if (!uri) return Promise.reject(new Error('MONGODB_URI não configurado no backend/.env.'));
  if (!connecting) {
    connecting = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 15_000 })
      .then(() => getDb())
      .catch((err) => {
        connecting = null; // permite nova tentativa
        throw err;
      });
  }
  return connecting;
}

mongoose.connection.on('disconnected', () => !closing && console.warn('[MongoDB] Conexão perdida; o driver tentará reconectar.'));
mongoose.connection.on('reconnected', () => console.log('[MongoDB] Reconectado.'));
mongoose.connection.on('error', (err) => logError('MongoDB', err));

/**
 * Acesso direto às coleções (sem schemas do Mongoose) usando a conexão do Mongoose.
 * O servidor só começa a escutar depois de `connectDatabase()`, então nas rotas isto
 * sempre está disponível; se não estiver, falha com um erro explícito.
 */
export function getDb(): Db {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB ainda não está conectado.');
  return db;
}

export async function disconnectDatabase() {
  closing = true;
  try {
    await mongoose.disconnect();
  } finally {
    connecting = null;
    closing = false;
  }
}
