import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// Todo valor vindo do cliente é validado como tipo primitivo antes de chegar ao Mongo.
// Isso bloqueia NoSQL injection ({"$ne": null}, {"$gt": ""}) e arrays inesperados,
// que o parser de query string (qs) e o JSON do body aceitam por padrão.

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

/**
 * IDs usados no banco e nas URLs da Umbler (chatId, messageId, topicId, kbId...).
 * Ex.: 'ZfnQ9OEJHZvJ95w6', 'acpzV_4hy6-atHJl', 'reason_kb_fail'. O formato restrito
 * também impede montar outro caminho da API da Umbler (ex.: '../../tags').
 */
export const idSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'ID em formato inválido.');

/** Nome de módulo da base: vira nome de arquivo na Umbler, então sem barras nem caracteres de controle. */
export const moduleNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001f\u007f/\\]+$/, 'Nome de módulo inválido.');

const optionalId = z.preprocess(emptyToUndefined, idSchema.optional());
const nullableId = z.preprocess(emptyToNull, idSchema.nullable().optional());
const text = (max: number) => z.string().max(max);
const optionalText = (max: number) => z.preprocess(emptyToNull, z.string().max(max).nullable().optional());
const flag = z.union([z.boolean(), z.literal(0), z.literal(1)]).optional();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD.');

// ---------- Login ----------

export const loginBodySchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

// ---------- Chats / auditorias ----------

export const chatsQuerySchema = z.object({
  status: z.enum(['abertos', 'finalizados', 'ocultos']).optional(),
  attendantId: z.union([z.literal('TODOS'), idSchema]).optional(),
  carteira: text(60).optional(),
  search: text(200).optional(),
});

const failReasonsSchema = z.array(idSchema).max(50).optional();

export const chatAuditBodySchema = z.object({
  chatId: idSchema,
  clientName: optionalText(300),
  carteiraTag: optionalText(100),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  topicId: nullableId,
  subtopicId: nullableId,
  failReasons: failReasonsSchema,
  violatedPromptRules: flag,
  knowledgeBaseFail: flag,
  auditorFeedback: optionalText(10_000),
  auditorEmail: optionalText(200),
});

export const messageAuditBodySchema = z.object({
  chatId: idSchema,
  messageId: idSchema,
  clientQuestion: optionalText(20_000),
  topicId: nullableId,
  subtopicId: nullableId,
  failReasons: failReasonsSchema,
  violatedPromptRules: flag,
  knowledgeBaseFail: flag,
  auditorFeedback: optionalText(10_000),
  trainAi: z.boolean().optional(),
  targetModule: z.preprocess(emptyToNull, moduleNameSchema.nullable().optional()),
  qaQuestion: optionalText(5_000),
  qaAnswer: optionalText(20_000),
  auditorEmail: optionalText(200),
});

export const nameBodySchema = z.object({ name: z.string().trim().min(1).max(200) });

export const reportQuerySchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  reasonId: optionalId,
});

// ---------- Base de conhecimento ----------

const kbFields = {
  knowledgeBaseId: optionalId,
  knowledgeBaseName: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
};

export const syncUmblerBodySchema = z.object({ moduleName: moduleNameSchema, ...kbFields });
export const uploadBodySchema = z.object(kbFields);
export const updateModuleBodySchema = z.object({ textContent: z.string().min(1).max(5_000_000), ...kbFields });
export const exportQuerySchema = z.object({ moduleName: moduleNameSchema.optional() });
export const backupsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  beforeCreatedAt: z.iso.datetime().optional(),
  beforeId: optionalId,
});

// ---------- Helpers ----------

function describe(error: z.ZodError) {
  // Só caminho + motivo; nunca devolve o valor recebido.
  return error.issues.map(i => ({ field: i.path.join('.') || '(raiz)', message: i.message }));
}

/** Valida `data`; em caso de erro responde 400 e retorna null. */
export function parseInput<T extends z.ZodType>(schema: T, data: unknown, res: Response): z.infer<T> | null {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  res.status(400).json({ error: 'Dados de entrada inválidos.', details: describe(result.error) });
  return null;
}

/** Para `app.param` / `router.param`: rejeita o parâmetro de rota fora do schema. */
export function paramValidator(schema: z.ZodType) {
  return (_req: Request, res: Response, next: NextFunction, value: unknown) => {
    const result = schema.safeParse(value);
    if (result.success) return next();
    return res.status(400).json({ error: 'Parâmetro de rota inválido.', details: describe(result.error) });
  };
}
