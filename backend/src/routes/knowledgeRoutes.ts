import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getDb, type Db } from '../config/db.js';
import { UmblerService } from '../services/umbler.js';
import { logError } from '../utils/logger.js';
import { sendError, UmblerError } from '../utils/httpErrors.js';
import {
  idSchema, moduleNameSchema, paramValidator, parseInput, syncUmblerBodySchema, uploadBodySchema,
  updateModuleBodySchema, exportQuerySchema, backupsQuerySchema,
} from '../validation/schemas.js';

const router = Router();
// Limite de 5 MB por arquivo, na memória: evita esgotar a RAM com uploads gigantes.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

router.param('moduleName', paramValidator(moduleNameSchema));
router.param('id', paramValidator(idSchema));

// Chamado uma vez na inicialização do servidor, depois da conexão com o banco.
export async function ensureKnowledgeIndexes() {
  const db = getDb();
  await Promise.all([
    db.collection('knowledgeBackups').createIndex({ module: 1, createdAt: -1, id: -1 }),
    db.collection('knowledgeBackups').createIndex({ id: 1 }),
  ]);
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeDoc = any;

// Itens salvos pelo editor/upload têm `order` (posição no arquivo). Itens inseridos por
// outras rotas (auditoria, Strapi) não têm e vão para o final, agrupados por seção.
function sortModuleItems(items: KnowledgeDoc[]): KnowledgeDoc[] {
  return [...items].sort((a, b) => {
    const oa = typeof a.order === 'number' ? a.order : Infinity;
    const ob = typeof b.order === 'number' ? b.order : Infinity;
    if (oa !== ob) return oa - ob;
    const sa = a.section || '';
    const sb = b.section || '';
    if (sa !== sb) return sa.localeCompare(sb);
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });
}

async function loadModuleItems(db: Db, moduleName: string): Promise<KnowledgeDoc[]> {
  const items = await db.collection('knowledge').find({ module: moduleName }).toArray();
  return sortModuleItems(items);
}

interface ParseBase {
  module: string;
  source: 'upload_txt' | 'manual';
  knowledgeBaseId?: string;
  knowledgeBaseName?: string;
  createdAt: string;
  updatedAt: string;
}

function parseTxtToItems(textContent: string, base: ParseBase): KnowledgeDoc[] {
  const lines = textContent.split('\n');
  let currentSection = 'Geral';
  let currentTitle = '';
  let currentContent = '';
  let hasStructuredItems = false;
  const itemsToSave: KnowledgeDoc[] = [];

  function flushItem() {
    if (currentTitle.trim() || currentContent.trim()) {
      itemsToSave.push({
        id: newId(),
        module: base.module,
        section: currentSection,
        title: currentTitle.trim() || 'Tópico',
        content: currentContent.trim(),
        source: base.source,
        order: itemsToSave.length,
        knowledgeBaseId: base.knowledgeBaseId,
        knowledgeBaseName: base.knowledgeBaseName,
        createdAt: base.createdAt,
        updatedAt: base.updatedAt
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
    itemsToSave[0].source = `${base.source}_raw`;
  }

  return itemsToSave;
}

// Campos de origem que o texto do módulo não carrega e que não podem se perder quando o
// módulo é reescrito (editor ou reupload): sem eles, Q&As da auditoria deixam de contar
// em "Treinamentos Realizados" e o webhook do Strapi duplica as novidades.
const ORIGIN_FIELDS = ['source', 'strapiKey', 'releaseDate'] as const;
const PRESERVED_SOURCES = new Set(['auditoria', 'strapi_webhook']);

const normalizeKey = (v: unknown) => String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Casa cada item novo com um item antigo equivalente e herda os campos de origem.
 *
 * O parser corta a linha `* título: conteúdo` no primeiro ":", então um título que
 * contém ":" (ex.: "Quais são as novidades sobre: Nova tela?") volta do texto partido.
 * Por isso o índice usa só o trecho do título antes do primeiro ":" e, havendo match,
 * confere se a linha reconstruída começa com o título antigo completo — nesse caso
 * restaura título e conteúdo corretos. Busca primeiro na mesma seção e depois em
 * qualquer seção (item movido); títulos repetidos são consumidos em ordem.
 */
export function inheritOriginMetadata(newItems: KnowledgeDoc[], oldItems: KnowledgeDoc[]): KnowledgeDoc[] {
  const candidates = oldItems.filter(it => PRESERVED_SOURCES.has(it.source));
  if (candidates.length === 0) return newItems;

  const head = (title: unknown) => normalizeKey(String(title ?? '').split(':')[0]);
  const used = new Set<KnowledgeDoc>();
  const bySection = new Map<string, KnowledgeDoc[]>();
  const byHead = new Map<string, KnowledgeDoc[]>();
  for (const it of candidates) {
    const k1 = `${normalizeKey(it.section)}\u0000${head(it.title)}`;
    const k2 = head(it.title);
    (bySection.get(k1) ?? bySection.set(k1, []).get(k1)!).push(it);
    (byHead.get(k2) ?? byHead.set(k2, []).get(k2)!).push(it);
  }

  // Devolve { title, content } do item novo reinterpretado com o título antigo, ou null.
  const align = (item: KnowledgeDoc, old: KnowledgeDoc): { title: string; content: string } | null => {
    const oldTitle = String(old.title ?? '');
    if (!oldTitle.includes(':')) {
      return normalizeKey(item.title) === normalizeKey(oldTitle) ? { title: item.title, content: item.content } : null;
    }
    const line = `${item.title}: ${item.content}`;
    const prefix = `${oldTitle}:`;
    if (!normalizeKey(line).startsWith(normalizeKey(prefix))) return null;
    // Avança na linha original até consumir o título antigo inteiro (ignorando espaços).
    const target = prefix.replace(/\s+/g, '');
    let consumed = 0;
    let i = 0;
    while (i < line.length && consumed < target.length) {
      if (!/\s/.test(line[i])) consumed++;
      i++;
    }
    return { title: oldTitle, content: line.slice(i).trim() };
  };

  const take = (item: KnowledgeDoc, list?: KnowledgeDoc[]) => {
    for (const old of list ?? []) {
      if (used.has(old)) continue;
      const aligned = align(item, old);
      if (aligned) return { old, aligned };
    }
    return null;
  };

  return newItems.map(item => {
    const found =
      take(item, bySection.get(`${normalizeKey(item.section)}\u0000${head(item.title)}`)) ??
      take(item, byHead.get(head(item.title)));
    if (!found) return item;
    used.add(found.old);
    const inherited = { ...item, title: found.aligned.title, content: found.aligned.content };
    for (const field of ORIGIN_FIELDS) {
      if (found.old[field] !== undefined) inherited[field] = found.old[field];
    }
    return inherited;
  });
}

// Guarda o texto anterior do módulo antes de sobrescrevê-lo. Não cria backup quando nada
// mudou ou quando o último backup já tem exatamente esse conteúdo.
async function saveBackupIfChanged(db: Db, moduleName: string, oldText: string, newText: string, reason: 'edit' | 'upload') {
  if (!oldText || oldText === newText) return;
  const latest = await db.collection('knowledgeBackups')
    .find({ module: moduleName }, { projection: { content: 1 } })
    .sort({ createdAt: -1, id: -1 })
    .limit(1)
    .next();
  if (latest?.content === oldText) return;
  await db.collection('knowledgeBackups').insertOne({
    id: newId(),
    module: moduleName,
    content: oldText,
    reason,
    size: oldText.length,
    lineCount: oldText.split('\n').length,
    createdAt: new Date().toISOString()
  });
}

function buildTxtFromItems(items: KnowledgeDoc[]): string {
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
    return sendError(res, error, 'GET /api/knowledge/umbler-bases');
  }
});

// Lista paginada (cursor) dos backups de um módulo, sem o conteúdo — o texto de cada
// versão é buscado sob demanda em GET /backups/:id.
router.get('/module/:moduleName/backups', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const query = parseInput(backupsQuerySchema, req.query, res);
    if (!query) return;
    const limit = query.limit ?? 20;
    const cursorCreatedAt = query.beforeCreatedAt ?? null;
    const cursorId = query.beforeId ?? '';

    const match: Record<string, unknown> = { module: req.params.moduleName };
    if (cursorCreatedAt) {
      match.$or = [
        { createdAt: { $lt: cursorCreatedAt } },
        { createdAt: cursorCreatedAt, id: { $lt: cursorId } },
      ];
    }

    const docs = await db.collection('knowledgeBackups').aggregate([
      { $match: match },
      { $sort: { createdAt: -1, id: -1 } },
      { $limit: limit + 1 },
      {
        $project: {
          _id: 0,
          id: 1,
          module: 1,
          createdAt: 1,
          reason: { $ifNull: ['$reason', 'edit'] },
          size: { $ifNull: ['$size', { $strLenCP: { $ifNull: ['$content', ''] } }] },
        },
      },
    ]).toArray();

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? { beforeCreatedAt: last.createdAt, beforeId: last.id } : null;

    return res.json({ items, nextCursor });
  } catch (error: any) {
    return sendError(res, error, 'GET /api/knowledge/module/:moduleName/backups');
  }
});

// Texto atual do módulo, montado exatamente como o backup e o export são montados,
// para que o diff não mostre diferenças falsas.
router.get('/module/:moduleName/current-text', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const items = await loadModuleItems(db, req.params.moduleName);
    return res.json({ content: buildTxtFromItems(items), itemCount: items.length });
  } catch (error: any) {
    return sendError(res, error, 'GET /api/knowledge/module/:moduleName/current-text');
  }
});

router.get('/backups/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const backup = await db.collection('knowledgeBackups').findOne({ id: req.params.id }, { projection: { _id: 0 } });
    if (!backup) return res.status(404).json({ error: 'Backup não encontrado.' });
    return res.json(backup);
  } catch (error: any) {
    return sendError(res, error, 'GET /api/knowledge/backups/:id');
  }
});

router.delete('/backups/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { deletedCount } = await db.collection('knowledgeBackups').deleteOne({ id: req.params.id });
    if (!deletedCount) return res.status(404).json({ error: 'Backup não encontrado.' });
    return res.json({ success: true });
  } catch (error: any) {
    return sendError(res, error, 'DELETE /api/knowledge/backups/:id');
  }
});

router.post('/sync-umbler', async (req: Request, res: Response) => {
  try {
    const input = parseInput(syncUmblerBodySchema, req.body, res);
    if (!input) return;
    const { moduleName, knowledgeBaseId } = input;

    const db = getDb();
    const items = await loadModuleItems(db, moduleName);

    if (items.length === 0) return res.status(404).json({ error: 'Módulo não encontrado no banco local.' });

    const content = buildTxtFromItems(items);
    await UmblerService.syncKnowledgeDocument(`${moduleName}.txt`, content, knowledgeBaseId);

    return res.json({ success: true });
  } catch (error: any) {
    logError('Umbler syncKnowledgeDocument', error);
    if (error instanceof UmblerError && error.status === 404) {
       return res.status(404).json({ error: 'Nenhuma alteração nova para enviar.' });
    }
    return sendError(res, error, 'POST /api/knowledge/sync-umbler');
  }
});

router.post('/upload-txt', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const input = parseInput(uploadBodySchema, req.body, res);
    if (!input) return;
    const { knowledgeBaseId, knowledgeBaseName } = input;

    let originalName = req.file.originalname;
    try {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8');
    } catch (e) {
      logError('Upload: conversão do nome do arquivo', e);
    }

    const parsedModule = moduleNameSchema.safeParse(originalName.replace(/\.[^/.]+$/, "").trim() || 'Módulo Geral');
    if (!parsedModule.success) return res.status(400).json({ error: 'Nome de arquivo inválido para um módulo.' });
    const currentModule = parsedModule.data;

    let textContent = req.file.buffer.toString('utf-8');
    if (textContent.charCodeAt(0) === 0xFEFF) {
      textContent = textContent.slice(1);
    }

    const nowIso = new Date().toISOString();
    const parsedItems = parseTxtToItems(textContent, {
      module: currentModule,
      source: 'upload_txt',
      knowledgeBaseId,
      knowledgeBaseName,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const db = getDb();
    const previousItems = await loadModuleItems(db, currentModule);
    const itemsToSave = inheritOriginMetadata(parsedItems, previousItems);
    const previousKbId = previousItems[0]?.knowledgeBaseId;
    
    if (previousKbId && previousKbId !== knowledgeBaseId) {
      try {
        await UmblerService.deleteKnowledgeDocument(`${currentModule}.txt`, previousKbId);
      } catch (error: any) {
        logError(`Umbler remover "${currentModule}" da base antiga`, error);
      }
    }

    if (itemsToSave.length > 0) {
      await saveBackupIfChanged(db, currentModule, buildTxtFromItems(previousItems), buildTxtFromItems(itemsToSave), 'upload');
      await db.collection('knowledge').deleteMany({ module: currentModule });
      await db.collection('knowledge').insertMany(itemsToSave);
    }

    return res.status(200).json({ message: 'Base importada com sucesso!', totalItems: itemsToSave.length, umblerSynced: false });
  } catch (error: any) {
    return sendError(res, error, 'POST /api/knowledge/upload-txt');
  }
});

router.put('/module/:moduleName', async (req: Request, res: Response) => {
  try {
    const { moduleName } = req.params;
    const input = parseInput(updateModuleBodySchema, req.body, res);
    if (!input) return;
    const { textContent } = input;

    const db = getDb();
    
    const existingItems = await loadModuleItems(db, moduleName);

    const createdAt = existingItems.length > 0 && existingItems[0].createdAt ? existingItems[0].createdAt : new Date().toISOString();
    const updatedAt = new Date().toISOString();

    const previousKbId = existingItems[0]?.knowledgeBaseId;
    const knowledgeBaseId = input.knowledgeBaseId || previousKbId || undefined;
    const knowledgeBaseName = input.knowledgeBaseName || existingItems[0]?.knowledgeBaseName || undefined;

    const itemsToSave = inheritOriginMetadata(parseTxtToItems(textContent, {
      module: moduleName,
      source: 'manual',
      knowledgeBaseId,
      knowledgeBaseName,
      createdAt,
      updatedAt,
    }), existingItems);

    await saveBackupIfChanged(db, moduleName, buildTxtFromItems(existingItems), buildTxtFromItems(itemsToSave), 'edit');

    if (previousKbId && previousKbId !== knowledgeBaseId) {
      try {
        await UmblerService.deleteKnowledgeDocument(`${moduleName}.txt`, previousKbId);
      } catch (error: any) {
        logError(`Umbler remover "${moduleName}" da base antiga`, error);
      }
    }

    await db.collection('knowledge').deleteMany({ module: moduleName });
    
    if (itemsToSave.length > 0) {
      await db.collection('knowledge').insertMany(itemsToSave);
    }

    return res.json({ success: true, totalItems: itemsToSave.length, umblerSynced: false });
  } catch (error: any) {
    return sendError(res, error, 'PUT /api/knowledge/module/:moduleName');
  }
});

router.get('/export-txt', async (req: Request, res: Response) => {
  try {
    const query = parseInput(exportQuerySchema, req.query, res);
    if (!query) return;
    const moduleName = query.moduleName ?? null;
    const filter: Record<string, string> = {};
    if (moduleName) filter.module = moduleName;

    const db = getDb();
    const allItems = await db.collection('knowledge').find(filter).toArray();
    // Agrupa por módulo mantendo a ordem interna de cada um.
    const items = moduleName
      ? sortModuleItems(allItems)
      : Object.values(allItems.reduce<Record<string, KnowledgeDoc[]>>((acc, it) => {
          (acc[it.module] ||= []).push(it);
          return acc;
        }, {})).flatMap(sortModuleItems);

    if (items.length === 0) return res.status(404).json({ error: 'Nenhum dado encontrado.' });

    const txtOutput = buildTxtFromItems(items);

    const filename = moduleName
      ? `${moduleName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_atualizado.txt` 
      : 'base_conhecimento_completa.txt';

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(txtOutput.trim());
  } catch (error: any) {
    return sendError(res, error, 'GET /api/knowledge/export-txt');
  }
});

router.delete('/module/:moduleName', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existingItems = await db.collection('knowledge').find({ module: req.params.moduleName }).toArray();
    const knowledgeBaseId = existingItems[0]?.knowledgeBaseId;

    await db.collection('knowledge').deleteMany({ module: req.params.moduleName });
    await db.collection('knowledgeBackups').deleteMany({ module: req.params.moduleName });

    let umblerSynced = false;
    try {
      await UmblerService.deleteKnowledgeDocument(`${req.params.moduleName}.txt`, knowledgeBaseId);
      umblerSynced = true;
    } catch (error: any) {
      logError(`Umbler remover "${req.params.moduleName}"`, error);
    }

    return res.json({ success: true, umblerSynced });
  } catch (error: any) {
    return sendError(res, error, 'DELETE /api/knowledge/module/:moduleName');
  }
});

router.get('/modules', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const modules = await db.collection('knowledge').distinct('module');
    return res.json(modules);
  } catch (error: any) {
    return sendError(res, error, 'GET /api/knowledge/modules');
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const items = await db.collection('knowledge').find({}).sort({ module: 1, section: 1 }).toArray();
    return res.json(items);
  } catch (error: any) {
    return sendError(res, error, 'GET /api/knowledge/');
  }
});

export default router;