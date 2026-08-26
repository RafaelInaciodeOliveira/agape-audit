import { Router, Request, Response } from 'express';
import multer from 'multer';
import { MongoClient, Db } from 'mongodb';
import { UmblerService } from '../services/umbler.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

let dbInstance: Db | null = null;
async function getDb(): Promise<Db> {
  if (dbInstance) return dbInstance;
  const client = new MongoClient(process.env.MONGODB_URI as string);
  await client.connect();
  dbInstance = client.db();
  return dbInstance;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTxtFromItems(items: any[]): string {
  let txtOutput = '';
  let lastSection = '';
  for (const item of items) {
    if (item.source?.includes('raw')) {
      txtOutput += `${item.content}\n`;
      continue;
    }
    if (item.section && item.section !== lastSection) {
      txtOutput += `\n## ${item.section}\n`;
      lastSection = item.section;
    }
    const titleFormat = item.title === 'Instrução' || item.title === 'Tópico' ? '' : `${item.title}: `;
    txtOutput += `* ${titleFormat}${item.content}\n`;
  }
  return txtOutput.trim();
}

router.get('/umbler-bases', async (_req: Request, res: Response) => {
  try {
    const bases = await UmblerService.listKnowledgeBases();
    res.json(bases);
  } catch (error: any) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

router.get('/module/:moduleName/backups', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const backups = await db.collection('knowledgeBackups')
      .find({ module: req.params.moduleName })
      .sort({ createdAt: -1 })
      .toArray();
    return res.json(backups);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// NOVA ROTA: Apagar um backup específico
router.delete('/backups/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    await db.collection('knowledgeBackups').deleteOne({ id: req.params.id });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/sync-umbler', async (req: Request, res: Response) => {
  try {
    const { moduleName, knowledgeBaseId } = req.body;
    if (!moduleName) return res.status(400).json({ error: 'Nome do módulo ausente.' });

    const db = await getDb();
    const items = await db.collection('knowledge').find({ module: moduleName }).sort({ section: 1, createdAt: 1 }).toArray();

    if (items.length === 0) return res.status(404).json({ error: 'Módulo não encontrado no banco local.' });

    const content = buildTxtFromItems(items);
    await UmblerService.syncKnowledgeDocument(`${moduleName}.txt`, content, knowledgeBaseId);

    return res.json({ success: true });
  } catch (error: any) {
    console.error(`Erro ao sincronizar "${req.body.moduleName}":`, error.response?.data || error.message);
    if (error.response && error.response.status === 404) {
       return res.status(404).json({ error: 'Nenhuma alteração nova para enviar.' });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.post('/upload-txt', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const knowledgeBaseId = req.body.knowledgeBaseId || undefined;
    const knowledgeBaseName = req.body.knowledgeBaseName || undefined;

    let originalName = req.file.originalname;
    try {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8');
    } catch (e) {
      console.log('Erro ao converter nome do arquivo', e);
    }

    const currentModule = originalName.replace(/\.[^/.]+$/, "").trim() || 'Módulo Geral';

    let textContent = req.file.buffer.toString('utf-8');
    if (textContent.charCodeAt(0) === 0xFEFF) {
      textContent = textContent.slice(1);
    }

    const lines = textContent.split('\n');
    let currentSection = 'Geral';
    let currentTitle = '';
    let currentContent = '';
    let hasStructuredItems = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsToSave: any[] = [];
    const nowIso = new Date().toISOString();

    function flushItem() {
      if (currentTitle.trim() || currentContent.trim()) {
        itemsToSave.push({
          id: newId(),
          module: currentModule,
          section: currentSection,
          title: currentTitle.trim() || 'Tópico',
          content: currentContent.trim(),
          source: 'upload_txt',
          knowledgeBaseId,
          knowledgeBaseName,
          createdAt: nowIso,
          updatedAt: nowIso
        });
        currentTitle = '';
        currentContent = '';
      }
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
         if (currentContent) currentContent += '\n';
         continue;
      }
      if (trimmed.toLowerCase().startsWith('módulo ') || trimmed.toLowerCase().startsWith('modulo ')) {
        flushItem();
        currentSection = trimmed.replace(/^#+\s*/, '');
        continue;
      }
      if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        flushItem();
        currentSection = trimmed.replace(/^#+\s*/, '');
        continue;
      }
      if (trimmed.startsWith('*')) {
        hasStructuredItems = true;
        flushItem();
        const itemText = trimmed.substring(1).trim();
        const colonIndex = itemText.indexOf(':');

        if (colonIndex !== -1 && colonIndex < 120) {
          currentTitle = itemText.substring(0, colonIndex).trim();
          currentContent = itemText.substring(colonIndex + 1).trim() + '\n';
        } else {
          currentTitle = 'Instrução';
          currentContent = itemText + '\n';
        }
        continue;
      }
      currentContent += trimmed + '\n';
    }
    flushItem();

    if (!hasStructuredItems && itemsToSave.length === 1) {
      itemsToSave[0].section = 'Documentação Técnica / Especificação';
      itemsToSave[0].title = 'Estrutura Completa de Dados';
      itemsToSave[0].source = 'upload_txt_raw';
    }

    const db = await getDb();
    const previousItems = await db.collection('knowledge').find({ module: currentModule }).toArray();
    const previousKbId = previousItems[0]?.knowledgeBaseId;
    
    if (previousKbId && previousKbId !== knowledgeBaseId) {
      try {
        await UmblerService.deleteKnowledgeDocument(`${currentModule}.txt`, previousKbId);
      } catch (error: any) {
        console.error(`Erro ao remover "${currentModule}" da base antiga:`, error.response?.data || error.message);
      }
    }

    if (itemsToSave.length > 0) {
      await db.collection('knowledge').deleteMany({ module: currentModule });
      await db.collection('knowledge').insertMany(itemsToSave);
    }

    return res.status(200).json({ message: 'Base importada com sucesso!', totalItems: itemsToSave.length, umblerSynced: false });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao processar arquivo.' });
  }
});

router.put('/module/:moduleName', async (req: Request, res: Response) => {
  try {
    const { moduleName } = req.params;
    const { textContent } = req.body;

    if (!textContent) return res.status(400).json({ error: 'Conteúdo vazio.' });

    const db = await getDb();
    
    const existingItems = await db.collection('knowledge')
      .find({ module: moduleName })
      .sort({ section: 1, createdAt: 1 })
      .toArray();
    
    if (existingItems.length > 0) {
      const oldText = buildTxtFromItems(existingItems);
      await db.collection('knowledgeBackups').insertOne({
        id: newId(),
        module: moduleName,
        content: oldText,
        createdAt: new Date().toISOString()
      });
    }

    const createdAt = existingItems.length > 0 && existingItems[0].createdAt ? existingItems[0].createdAt : new Date().toISOString();
    const updatedAt = new Date().toISOString();

    const previousKbId = existingItems[0]?.knowledgeBaseId;
    const knowledgeBaseId = req.body.knowledgeBaseId || previousKbId || undefined;
    const knowledgeBaseName = req.body.knowledgeBaseName || existingItems[0]?.knowledgeBaseName || undefined;

    const lines = textContent.split('\n');
    let currentSection = 'Geral';
    let currentTitle = '';
    let currentContent = '';
    let hasStructuredItems = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsToSave: any[] = [];

    function flushItem() {
      if (currentTitle.trim() || currentContent.trim()) {
        itemsToSave.push({
          id: newId(),
          module: moduleName,
          section: currentSection,
          title: currentTitle.trim() || 'Tópico',
          content: currentContent.trim(),
          source: 'manual',
          knowledgeBaseId,
          knowledgeBaseName,
          createdAt,
          updatedAt
        });
        currentTitle = '';
        currentContent = '';
      }
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
         if (currentContent) currentContent += '\n';
         continue;
      }
      if (trimmed.toLowerCase().startsWith('módulo ') || trimmed.toLowerCase().startsWith('modulo ')) {
        flushItem();
        currentSection = trimmed.replace(/^#+\s*/, '');
        continue;
      }
      if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        flushItem();
        currentSection = trimmed.replace(/^#+\s*/, '');
        continue;
      }
      if (trimmed.startsWith('*')) {
        hasStructuredItems = true;
        flushItem();
        const itemText = trimmed.substring(1).trim();
        const colonIndex = itemText.indexOf(':');

        if (colonIndex !== -1 && colonIndex < 120) {
          currentTitle = itemText.substring(0, colonIndex).trim();
          currentContent = itemText.substring(colonIndex + 1).trim() + '\n';
        } else {
          currentTitle = 'Instrução';
          currentContent = itemText + '\n';
        }
        continue;
      }
      currentContent += trimmed + '\n';
    }
    flushItem();

    if (!hasStructuredItems && itemsToSave.length === 1) {
      itemsToSave[0].section = 'Documentação Técnica / Especificação';
      itemsToSave[0].title = 'Estrutura Completa de Dados';
      itemsToSave[0].source = 'manual_raw';
    }

    if (previousKbId && previousKbId !== knowledgeBaseId) {
      try {
        await UmblerService.deleteKnowledgeDocument(`${moduleName}.txt`, previousKbId);
      } catch (error: any) {
        console.error(`Erro ao remover "${moduleName}" da base antiga:`, error.response?.data || error.message);
      }
    }

    await db.collection('knowledge').deleteMany({ module: moduleName });
    
    if (itemsToSave.length > 0) {
      await db.collection('knowledge').insertMany(itemsToSave);
    }

    return res.json({ success: true, totalItems: itemsToSave.length, umblerSynced: false });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/export-txt', async (req: Request, res: Response) => {
  try {
    const moduleName = req.query.moduleName ? String(req.query.moduleName) : null;
    const filter: any = {};
    if (moduleName) filter.module = moduleName;

    const db = await getDb();
    const items = await db.collection('knowledge').find(filter).sort({ section: 1, createdAt: 1 }).toArray();

    if (items.length === 0) return res.status(404).json({ error: 'Nenhum dado encontrado.' });

    const txtOutput = buildTxtFromItems(items);

    const filename = moduleName
      ? `${moduleName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_atualizado.txt` 
      : 'base_conhecimento_completa.txt';

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(txtOutput.trim());
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao exportar arquivo.' });
  }
});

router.delete('/module/:moduleName', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const existingItems = await db.collection('knowledge').find({ module: req.params.moduleName }).toArray();
    const knowledgeBaseId = existingItems[0]?.knowledgeBaseId;

    await db.collection('knowledge').deleteMany({ module: req.params.moduleName });
    await db.collection('knowledgeBackups').deleteMany({ module: req.params.moduleName });

    let umblerSynced = false;
    try {
      await UmblerService.deleteKnowledgeDocument(`${req.params.moduleName}.txt`, knowledgeBaseId);
      umblerSynced = true;
    } catch (error: any) {
      console.error(`Erro ao remover "${req.params.moduleName}" da Umbler:`, error.response?.data || error.message);
    }

    return res.json({ success: true, umblerSynced });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/modules', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const modules = await db.collection('knowledge').distinct('module');
    return res.json(modules);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao buscar módulos.' });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const items = await db.collection('knowledge').find({}).sort({ module: 1, section: 1 }).toArray();
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao buscar itens.' });
  }
});

export default router;