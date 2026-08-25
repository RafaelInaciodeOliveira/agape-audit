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

// Reconstrói o .txt a partir dos itens salvos (mesmo formato usado no export-txt)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTxtFromItems(items: any[]): string {
  let txtOutput = '';
  let lastSection = '';
  for (const item of items) {
    if (item.source?.includes('raw')) {
      txtOutput += `${item.content}\n\n`;
      continue;
    }
    if (item.section && item.section !== lastSection) {
      txtOutput += `\n## ${item.section}\n`;
      lastSection = item.section;
    }
    const titleFormat = item.title === 'Instrução' || item.title === 'Tópico' ? '' : `${item.title}: `;
    txtOutput += `* ${titleFormat}${item.content}\n\n`;
  }
  return txtOutput.trim();
}

// Sincroniza com a Umbler sem derrubar a resposta local se der erro
async function syncModuleToUmbler(moduleName: string, content: string): Promise<boolean> {
  try {
    await UmblerService.syncKnowledgeDocument(`${moduleName}.txt`, content);
    return true;
  } catch (error: any) {
    console.error(`Erro ao sincronizar "${moduleName}" com a Umbler:`, error.response?.data || error.message);
    return false;
  }
}

// 1. IMPORTAR ARQUIVO DE CONHECIMENTO (.TXT, .JSON, .SWAGGER)
router.post('/upload-txt', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

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

    // Função que empacota o bloco inteiro de texto e salva no card
    function flushItem() {
      if (currentTitle.trim() || currentContent.trim()) {
        itemsToSave.push({
          id: newId(),
          module: currentModule,
          section: currentSection,
          title: currentTitle.trim() || 'Tópico',
          content: currentContent.trim(),
          source: 'upload_txt',
          createdAt: nowIso,
          updatedAt: nowIso
        });
        currentTitle = '';
        currentContent = '';
      }
    }

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Preserva parágrafos vazios no meio do texto
      if (!trimmed) {
         if (currentContent) currentContent += '\n';
         continue;
      }

      if (trimmed.toLowerCase().startsWith('módulo ') || trimmed.toLowerCase().startsWith('modulo ')) {
        flushItem();
        currentSection = trimmed.replace(/^#+\s*/, '');
        continue;
      }

      // Só cria uma Sessão se tiver ESPAÇO depois do ## (Ex: "## Geral").
      // "##Etapa1." não tem espaço, então será salvo como texto normal do cliente!
      if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        flushItem();
        currentSection = trimmed.replace(/^#+\s*/, '');
        continue;
      }

      // Sempre que acha um *, finaliza o bloco anterior e começa um novo
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

      // Vai juntando todas as outras linhas ao conteúdo do card atual
      currentContent += trimmed + '\n';
    }
    // Salva o último bloco no fim do loop
    flushItem();

    if (!hasStructuredItems && itemsToSave.length === 1) {
      itemsToSave[0].section = 'Documentação Técnica / Especificação';
      itemsToSave[0].title = 'Estrutura Completa de Dados';
      itemsToSave[0].source = 'upload_txt_raw';
    }

    const db = await getDb();

    let umblerSynced = false;
    if (itemsToSave.length > 0) {
      await db.collection('knowledge').deleteMany({ module: currentModule });
      await db.collection('knowledge').insertMany(itemsToSave);
      umblerSynced = await syncModuleToUmbler(currentModule, buildTxtFromItems(itemsToSave));
    }

    return res.status(200).json({ message: 'Base importada com sucesso!', totalItems: itemsToSave.length, umblerSynced });
  } catch (error: any) {
    console.error('Erro ao processar arquivo:', error);
    return res.status(500).json({ error: error.message || 'Erro ao processar arquivo.' });
  }
});

// 2. SALVAR EDIÇÃO MANUAL
router.put('/module/:moduleName', async (req: Request, res: Response) => {
  try {
    const { moduleName } = req.params;
    const { textContent } = req.body;

    if (!textContent) return res.status(400).json({ error: 'Conteúdo vazio.' });

    const db = await getDb();
    const existingItems = await db.collection('knowledge').find({ module: moduleName }).sort({ createdAt: 1 }).toArray();
    const createdAt = existingItems.length > 0 && existingItems[0].createdAt ? existingItems[0].createdAt : new Date().toISOString();
    const updatedAt = new Date().toISOString();

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

    await db.collection('knowledge').deleteMany({ module: moduleName });
    let umblerSynced = false;
    if (itemsToSave.length > 0) {
      await db.collection('knowledge').insertMany(itemsToSave);
      umblerSynced = await syncModuleToUmbler(moduleName, buildTxtFromItems(itemsToSave));
    }

    return res.json({ success: true, totalItems: itemsToSave.length, umblerSynced });
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

// 4. DELETAR MÓDULO OU ITEM
router.delete('/module/:moduleName', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    await db.collection('knowledge').deleteMany({ module: req.params.moduleName });

    let umblerSynced = false;
    try {
      await UmblerService.deleteKnowledgeDocument(`${req.params.moduleName}.txt`);
      umblerSynced = true;
    } catch (error: any) {
      console.error(`Erro ao remover "${req.params.moduleName}" da Umbler:`, error.response?.data || error.message);
    }

    return res.json({ success: true, umblerSynced });
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