import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import finopsRoutes from './routes/finopsRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import configRoutes from './routes/configRoutes.js';
import taxonomyRoutes from './routes/taxonomyRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { authMiddleware } from './middlewares/authMiddleware.js';
import { sendError } from './utils/httpErrors.js';

// Toda rota em /api exige JWT, exceto as listadas aqui. O webhook do Strapi tem
// autenticação própria (STRAPI_WEBHOOK_SECRET).
const PUBLIC_API_PATHS = new Set(['/login', '/webhooks/strapi']);

/**
 * Monta a aplicação Express. É uma função (e não um módulo com efeito colateral) para
 * ler as variáveis de ambiente só depois de o .env ter sido carregado pelo server.ts.
 */
export function createApp() {
  const app = express();
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isFinite(hops) ? hops : process.env.TRUST_PROXY);
  }

  // Só o frontend configurado pode chamar a API pelo navegador. FRONTEND_URL aceita
  // várias origens separadas por vírgula. Requisições sem Origin (servidor a servidor,
  // como o webhook do Strapi) não são afetadas por CORS.
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
    // Necessário para o frontend ler o nome dos arquivos baixados (TXT/CSV).
    exposedHeaders: ['Content-Disposition'],
  }));
  // Limite maior que o padrão (100kb): webhooks do Strapi com rich text e passos passam disso
  app.use(express.json({ limit: '5mb' }));

  app.use('/api', authRoutes);
  app.use('/api', (req, res, next) => (PUBLIC_API_PATHS.has(req.path) ? next() : authMiddleware(req, res, next)));

  app.use('/api/knowledge', knowledgeRoutes);
  app.use('/api/finops', finopsRoutes);
  app.use('/api', chatRoutes);
  app.use('/api', auditRoutes);
  app.use('/api', configRoutes);
  app.use('/api', taxonomyRoutes);
  app.use('/api', reportRoutes);
  app.use('/api', webhookRoutes);
  app.use('/api', dashboardRoutes);

  // Erros não tratados nas rotas (upload grande demais, JSON malformado, etc.): responde
  // sem stack trace e registra só o erro técnico.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Arquivo grande demais (máximo de 5 MB).' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Corpo da requisição grande demais.' });
    return sendError(res, err, 'Erro não tratado');
  });

  return app;
}
