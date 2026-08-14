import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { UmblerService } from './services/umbler.js'; // ou .ts dependendo de como você roda
import axios from 'axios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const dbPromise = open({
  filename: './database.db',
  driver: sqlite3.Database
});

async function initDb() {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,
      chatId TEXT UNIQUE,
      clientName TEXT,
      carteiraTag TEXT,
      rating INTEGER,
      violatedPromptRules INTEGER,
      knowledgeBaseFail INTEGER,
      auditorFeedback TEXT,
      generatedQa INTEGER,
      qaQuestion TEXT,
      qaAnswer TEXT,
      auditorEmail TEXT,
      createdAt TEXT
    )
  `);
}
initDb();

const CARTEIRAS = ['ANTARES', 'ARCTURUS', 'ALPHA', 'SIGMA', 'SIRIUS'];

// ROTA 1: Busca a lista de chats (Versão otimizada anti-bloqueio)
app.get('/api/chats', async (req, res) => {
  try {
    const { carteira, search, onlyAgape, status } = req.query;
    const db = await dbPromise;
    const auditedList = await db.all('SELECT * FROM audit');

    // Faz APENAS UMA requisição para a Umbler (Busca a lista de contatos)
    const umblerChats = await UmblerService.getChats();
    const chatsToProcess = umblerChats || [];

    const analyzedChats = chatsToProcess.map((chat: any) => {
      const audit = auditedList.find((a: any) => a.chatId === chat.id);
      
      const combinedTags = [...(chat.tags || []), ...(chat.contact?.tags || [])];
      const tagNames = Array.from(new Set(combinedTags.map((t: any) => t.name).filter(Boolean))) as string[];

      const carteiraTag = tagNames.find((name: string) => 
        CARTEIRAS.some(c => name.toUpperCase().includes(c))
      ) || 'ANTARES';

      const lastMsgFromChat = chat.lastMessage;
      
      // Validação Leve: Checa apenas a última mensagem (evita o Erro 429 da Umbler)
      const hasAgapeInteracted = lastMsgFromChat ? (
        lastMsgFromChat.fromType === 'Bot' || 
        lastMsgFromChat.fromName === 'Ágape' || 
        lastMsgFromChat.botInstanceId || 
        lastMsgFromChat.aiAgentId ||
        lastMsgFromChat.sentByOrganizationMember === false ||
        (typeof lastMsgFromChat.content === 'string' && lastMsgFromChat.content.toLowerCase().includes('ágape'))
      ) : false;

      const lastMsgDate = 
        lastMsgFromChat?.createdAtUTC || lastMsgFromChat?.createdAt ||
        chat.updatedAtUTC || chat.updatedAt || chat.createdAt;

      const chatStatus = (chat.status || 'Open').toLowerCase();

      return {
        id: chat.id,
        contactName: chat.contact?.name || 'Cliente sem nome',
        contactPhone: chat.contact?.phoneNumber,
        carteiraTag,
        allTags: tagNames,
        lastMessage: lastMsgFromChat || null,
        updatedAt: lastMsgDate,
        hasAgapeInteracted, // O filtro vai usar isso
        chatStatus,
        audit: audit || null,
        cachedMessages: [] // Vazio! Força o frontend a buscar o histórico só quando você clicar
      };
    });

    let chats = analyzedChats;

    // Filtros de Status
    const targetStatus = status ? String(status).toLowerCase() : 'entrada';
    if (targetStatus === 'entrada') {
      chats = chats.filter((c: any) => c.chatStatus === 'open' || c.chatStatus === 'active');
    } else if (targetStatus === 'esperando') {
      chats = chats.filter((c: any) => c.chatStatus === 'waiting' || c.chatStatus === 'pending');
    } else if (targetStatus === 'finalizados') {
      chats = chats.filter((c: any) => c.chatStatus === 'closed' || c.chatStatus === 'finished');
    }

    // Filtro do Ágape
    if (onlyAgape === 'true') {
      chats = chats.filter((c: any) => c.hasAgapeInteracted);
    }

    // Ordenação (mais recentes primeiro)
    chats.sort((a: any, b: any) => {
      const dateA = new Date(a.updatedAt).getTime() || 0;
      const dateB = new Date(b.updatedAt).getTime() || 0;
      return dateB - dateA;
    });

    // Filtros de Carteira e Busca
    if (carteira && carteira !== 'TODAS') {
      chats = chats.filter((c: any) => c.carteiraTag.toUpperCase().includes(String(carteira).toUpperCase()));
    }
    if (search) {
      const term = String(search).toLowerCase();
      chats = chats.filter((c: any) => 
        c.contactName.toLowerCase().includes(term) ||
        JSON.stringify(c.lastMessage).toLowerCase().includes(term) ||
        c.allTags.some((t: string) => t.toLowerCase().includes(term))
      );
    }

    res.json({ total: chats.length, items: chats });
  } catch (error: any) {
    console.error('Erro ao buscar chats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chats/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Gera o momento exato de agora no formato que o Umbler pede (UTC)
    const currentUTC = new Date().toISOString();

    const umblerResponse = await axios.get(`https://api.umbler.com/v1/chats/${id}/relative-messages/`, {
      headers: { 
        'Authorization': `Bearer umbler-prover-2026-08-11-2094-08-29--624E76530CC13F77DF15FA91885DCCA190BBE2A0625B3BE80D905124FC49EAD4` 
      },
      // O Axios vai transformar isso em: ?organizationId=...&FromEventUTC=...&Take=50&Direction=TakeBefore
      params: {
        organizationId: 'ZfCELtVma2rJTTgy', // ⚠️ IMPORTANTE: Você precisa colocar o ID da sua organização aqui!
        FromEventUTC: currentUTC,
        Take: 250,                // Vai trazer as últimas 50 mensagens
        Direction: 'TakeBefore', // Traz as mensagens "antes" de agora (ou seja, o histórico)
        IncludeMetadata: false
      }
    });

    // Devolve pro frontend
    res.json(umblerResponse.data); 
  } catch (error: any) {
    console.error('Erro na integração:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar mensagens do Umbler' });
  }
});

// ROTA 3: Salvar Auditoria
app.post('/api/audits', async (req, res) => {
  try {
    const {
      chatId, clientName, carteiraTag, rating,
      violatedPromptRules, knowledgeBaseFail, auditorFeedback,
      trainAi, qaQuestion, qaAnswer, auditorEmail
    } = req.body;

    let generatedQa = 0;
    if (trainAi && qaQuestion && qaAnswer) {
      await UmblerService.createKnowledgeBaseQA(qaQuestion, qaAnswer);
      generatedQa = 1;
    }

    const db = await dbPromise;
    const id = Date.now().toString();

    await db.run(`
      INSERT OR REPLACE INTO audit 
      (id, chatId, clientName, carteiraTag, rating, violatedPromptRules, knowledgeBaseFail, auditorFeedback, generatedQa, qaQuestion, qaAnswer, auditorEmail, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, chatId, clientName, carteiraTag, rating,
      violatedPromptRules ? 1 : 0, knowledgeBaseFail ? 1 : 0,
      auditorFeedback, generatedQa,
      generatedQa ? qaQuestion : null,
      generatedQa ? qaAnswer : null,
      auditorEmail, new Date().toISOString()
    ]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Original Restaurado com Sucesso na porta ${PORT}!`);
});