// Carrega o .env antes de qualquer outro módulo ler process.env.
import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { ensureKnowledgeIndexes } from './routes/knowledgeRoutes.js';
import { initDb } from './services/seed.js';
import { getAgapeMemberId, seedBusinessConfig } from './services/businessConfig.js';
import { syncAiUsageFromUmbler } from './services/aiUsageSync.js';
import { logError } from './utils/logger.js';

const PORT = process.env.PORT || 3001;

// Importa periodicamente da Umbler o consumo (créditos) das respostas do Ágape para o painel de Custos de IA
function scheduleAiUsageSync() {
  if (!process.env.UMBLER_TOKEN) return;
  const minutes = Number(process.env.FINOPS_SYNC_INTERVAL_MIN || 15);
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  const run = () => syncAiUsageFromUmbler().catch((err) => logError('FinOps sync automático', err));
  setTimeout(run, 10_000);
  setInterval(run, minutes * 60_000);
}

// Ordem de inicialização: banco conectado → índices/seed → sync agendado → HTTP.
// Assim nenhuma rota roda antes de a conexão estar pronta.
async function start() {
  getAgapeMemberId(); // falha cedo se UMBLER_AGENT_ID não estiver no .env
  await connectDatabase();
  console.log('✅ [MongoDB] Conectado com sucesso (conexão única via Mongoose).');

  await initDb();
  await ensureKnowledgeIndexes();
  await seedBusinessConfig();
  scheduleAiUsageSync();

  createApp().listen(PORT, () => {
    console.log(`🚀 Servidor HTTP escutando na porta ${PORT}.`);
  });
}

start().catch((err) => {
  logError('Inicialização do servidor', err);
  console.error('❌ Servidor não iniciado: não foi possível conectar/preparar o MongoDB.');
  process.exit(1);
});
