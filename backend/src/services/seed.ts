import { getDb } from '../config/db.js';
import { newId } from '../utils/ids.js';

const DEFAULT_TOPICS: Array<{ name: string; subtopics: string[] }> = [
  { name: 'Cadastros', subtopics: ['Pessoas', 'Grupos', 'Importação'] },
  { name: 'Financeiro', subtopics: ['Fluxo de Caixa', 'Lançamentos', 'Relatórios'] },
  { name: 'Agenda', subtopics: [] },
  { name: 'Aplicativo / Site', subtopics: [] },
  { name: 'Processos e APIs', subtopics: [] },
  { name: 'Suporte Técnico', subtopics: [] },
  { name: 'Onboarding / Primeiros Passos', subtopics: [] },
  { name: 'Vendas / Comercial', subtopics: [] },
  { name: 'Outro', subtopics: [] },
];

// Índices das auditorias e dados iniciais (tópicos e motivos padrão) quando o banco está vazio.
export async function initDb() {
  const db = getDb();
  await db.collection('audits').createIndex({ chatId: 1 }, { unique: true });
  await db.collection('messageAudits').createIndex({ chatId: 1, messageId: 1 }, { unique: true });

  const existingTopics = await db.collection('topics').countDocuments();
  if (existingTopics === 0) {
    for (const topic of DEFAULT_TOPICS) {
      const topicId = newId();
      await db.collection('topics').insertOne({ id: topicId, name: topic.name, createdAt: new Date().toISOString() });
      for (const subtopicName of topic.subtopics) {
        await db.collection('subtopics').insertOne({
          id: newId(), topicId, name: subtopicName, createdAt: new Date().toISOString(),
        });
      }
    }
  }

  const existingReasons = await db.collection('failReasons').countDocuments();
  if (existingReasons === 0) {
    const DEFAULT_FAIL_REASONS = [
      { id: 'reason_violation', name: 'Violou diretrizes (ex: usou menus, se reapresentou)' },
      { id: 'reason_kb_fail', name: 'Resposta Incorreta / Falta na Base' }
    ];
    for (const fr of DEFAULT_FAIL_REASONS) {
      await db.collection('failReasons').insertOne({ ...fr, createdAt: new Date().toISOString() });
    }
  }
}
