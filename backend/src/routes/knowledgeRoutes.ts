import { Router, Request, Response } from 'express';
import multer from 'multer';
import { MongoClient, Db } from 'mongodb';

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

// 1. IMPORTAR ARQUIVO .TXT
router.post('/upload-txt', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const textContent = req.file.buffer.toString('utf-8');
    const lines = textContent.split('\n');

    let currentModule = 'Módulo Geral';
    let currentSection = 'Geral';
    const itemsToSave = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.toLowerCase().startsWith('módulo') || trimmed.toLowerCase().startsWith('modulo')) {
        currentModule = trimmed.replace(/^#+\s*/, '');
        continue;
      }

      if (/^(##\s*)?\d+\.\d+\./.test(trimmed)) {
        currentSection = trimmed.replace(/^#+\s*/, '');
        continue;
      }

      if (trimmed.startsWith('*')) {
        const itemText = trimmed.substring(1).trim();
        const colonIndex = itemText.indexOf(':');

        let title = 'Instrução';
        let content = itemText;

        if (colonIndex !== -1) {
          title = itemText.substring(0, colonIndex).trim();
          content = itemText.substring(colonIndex + 1).trim();
        }

        itemsToSave.push({
          id: newId(),
          module: currentModule,
          section: currentSection,
          title,
          content,
          source: 'upload_txt',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    const db = await getDb();

    if (itemsToSave.length > 0) {
      const modulesInFile = [...new Set(itemsToSave.map(i => i.module))];
      await db.collection('knowledge').deleteMany({ module: { $in: modulesInFile } });
      await db.collection('knowledge').insertMany(itemsToSave);
    }

    return res.status(200).json({ message: 'Base importada com sucesso!', totalItems: itemsToSave.length });
  } catch (error: any) {
    console.error('Erro ao processar TXT:', error);
    return res.status(500).json({ error: error.message || 'Erro ao processar arquivo.' });
  }
});

// 2. SALVAR EDIÇÃO MANUAL DO .TXT EM LOTE
router.put('/module/:moduleName', async (req: Request, res: Response) => {
  try {
    const { moduleName } = req.params;
    const { textContent } = req.body;

    if (!textContent) return res.status(400).json({ error: 'Conteúdo vazio.' });

    const lines = textContent.split('\n');
    let currentModule = moduleName;
    let currentSection = 'Geral';
    const itemsToSave = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.toLowerCase().startsWith('módulo') || trimmed.toLowerCase().startsWith('modulo')) {
        currentModule = trimmed.replace(/^#+\s*/, '');
        continue;
      }

      if (/^(##\s*)?\d+\.\d+\./.test(trimmed)) {
        currentSection = trimmed.replace(/^#+\s*/, '');
        continue;
      }

      if (trimmed.startsWith('*')) {
        const itemText = trimmed.substring(1).trim();
        const colonIndex = itemText.indexOf(':');

        let title = 'Instrução';
        let content = itemText;

        if (colonIndex !== -1) {
          title = itemText.substring(0, colonIndex).trim();
          content = itemText.substring(colonIndex + 1).trim();
        }

        itemsToSave.push({
          id: newId(),
          module: currentModule,
          section: currentSection,
          title,
          content,
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    const db = await getDb();
    await db.collection('knowledge').deleteMany({ module: moduleName });
    if (itemsToSave.length > 0) {
      await db.collection('knowledge').insertMany(itemsToSave);
    }

    return res.json({ success: true, totalItems: itemsToSave.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. EXPORTAR MÓDULO EM .TXT
router.get('/export-txt', async (req: Request, res: Response) => {
  try {
    const moduleName = req.query.moduleName ? String(req.query.moduleName) : null;
    const filter: any = {};
    if (moduleName) filter.module = moduleName;

    const db = await getDb();
    const items = await db.collection('knowledge').find(filter).sort({ section: 1, createdAt: 1 }).toArray();

    if (items.length === 0) return res.status(404).json({ error: 'Nenhum dado encontrado.' });

    let txtOutput = '';
    let lastModule = '';
    let lastSection = '';

    for (const item of items) {
      if (item.module !== lastModule) {
        txtOutput += `${item.module}\n\n`;
        lastModule = item.module;
      }

      if (item.section && item.section !== lastSection) {
        txtOutput += `\n## ${item.section}\n`;
        lastSection = item.section;
      }

      txtOutput += `* ${item.title}: ${item.content}\n`;
    }

    const filename = moduleName 
      ? `${moduleName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_atualizado.txt` 
      : 'base_conhecimento_completa.txt';

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(txtOutput);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao exportar arquivo.' });
  }
});

// 4. DELETAR MÓDULO OU ITEM
router.delete('/module/:moduleName', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    await db.collection('knowledge').deleteMany({ module: req.params.moduleName });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. RETORNAR MÓDULOS E ITENS
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