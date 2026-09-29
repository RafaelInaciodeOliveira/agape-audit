import { Request, Response } from 'express';
import { sendError } from '../utils/httpErrors.js';
import AiUsage from '../models/AiUsage.js';
import { syncAiUsageFromUmbler, getLastAiUsageSync } from '../services/aiUsageSync.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const DEFAULT_RECENT_LIMIT = 15;
const MAX_RECENT_LIMIT = 200;

// Mesmo critério dos relatórios: datas em YYYY-MM-DD interpretadas em UTC
function resolvePeriod(query: Request['query']) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 8)}01`;

  const startStr = typeof query.startDate === 'string' && query.startDate ? query.startDate : firstOfMonth;
  const endStr = typeof query.endDate === 'string' && query.endDate ? query.endDate : today;

  if (!DATE_RE.test(startStr) || !DATE_RE.test(endStr)) {
    return { error: 'Datas devem estar no formato YYYY-MM-DD.' };
  }

  const start = new Date(`${startStr}T00:00:00.000Z`);
  const end = new Date(`${endStr}T23:59:59.999Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { error: 'Data inválida.' };
  if (start > end) return { error: 'startDate deve ser anterior ou igual a endDate.' };
  if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
    return { error: `O período máximo é de ${MAX_RANGE_DAYS} dias.` };
  }

  return { start, end, startStr, endStr };
}

function listDays(startStr: string, endStr: string) {
  const days: string[] = [];
  const cursor = new Date(`${startStr}T00:00:00.000Z`);
  const last = new Date(`${endStr}T00:00:00.000Z`);
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

// GET /api/finops/costs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&page=1&limit=15
// Resumo, ranking e gráfico cobrem o período inteiro; só o extrato (recent) é paginado.
export async function getCosts(req: Request, res: Response) {
  try {
    const period = resolvePeriod(req.query);
    if ('error' in period) return res.status(400).json({ error: period.error });
    const { start, end, startStr, endStr } = period;

    const parsedLimit = parseInt(String(req.query.limit ?? ''), 10);
    const recentLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_RECENT_LIMIT)
      : DEFAULT_RECENT_LIMIT;
    const parsedPage = parseInt(String(req.query.page ?? ''), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const [[result], lastSyncAt] = await Promise.all([AiUsage.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalCost: { $sum: '$totalCost' },
                promptTokens: { $sum: '$promptTokens' },
                completionTokens: { $sum: '$completionTokens' },
                requests: { $sum: 1 },
              },
            },
          ],
          byModel: [
            {
              $group: {
                _id: '$modelName',
                totalCost: { $sum: '$totalCost' },
                promptTokens: { $sum: '$promptTokens' },
                completionTokens: { $sum: '$completionTokens' },
                requests: { $sum: 1 },
              },
            },
            { $sort: { totalCost: -1 } },
          ],
          daily: [
            {
              $group: {
                _id: {
                  day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'UTC' } },
                  modelName: '$modelName',
                },
                totalCost: { $sum: '$totalCost' },
              },
            },
          ],
          recent: [
            { $sort: { timestamp: -1, _id: -1 } },
            { $skip: (page - 1) * recentLimit },
            { $limit: recentLimit },
            {
              $project: {
                _id: 0,
                id: { $toString: '$_id' },
                userId: 1,
                userName: 1,
                chatId: 1,
                modelName: 1,
                credits: 1,
                tokensEstimated: 1,
                promptTokens: 1,
                completionTokens: 1,
                totalCost: 1,
                timestamp: 1,
              },
            },
          ],
        },
      },
    ]), getLastAiUsageSync()]);

    const summary = result.summary[0] || { totalCost: 0, promptTokens: 0, completionTokens: 0, requests: 0 };

    const byModel = result.byModel.map((m: any) => ({
      modelName: m._id,
      totalCost: m.totalCost,
      promptTokens: m.promptTokens,
      completionTokens: m.completionTokens,
      totalTokens: m.promptTokens + m.completionTokens,
      requests: m.requests,
    }));

    // Preenche dias sem consumo com zero para o gráfico não pular datas
    const costsByDay = new Map<string, Record<string, number>>();
    for (const row of result.daily) {
      const models = costsByDay.get(row._id.day) || {};
      models[row._id.modelName] = row.totalCost;
      costsByDay.set(row._id.day, models);
    }
    const daily = listDays(startStr, endStr).map((day) => {
      const models = costsByDay.get(day) || {};
      const totalCost = Object.values(models).reduce((s, v) => s + v, 0);
      return { day, totalCost, models };
    });

    return res.json({
      period: { startDate: startStr, endDate: endStr },
      currency: process.env.FINOPS_CURRENCY || 'BRL',
      lastSyncAt,
      summary: {
        totalCost: summary.totalCost,
        promptTokens: summary.promptTokens,
        completionTokens: summary.completionTokens,
        totalTokens: summary.promptTokens + summary.completionTokens,
        requests: summary.requests,
        mostExpensiveModel: byModel[0] || null,
      },
      models: byModel.map((m: any) => m.modelName),
      byModel,
      daily,
      recent: result.recent.map((r: any) => ({ ...r, totalTokens: r.promptTokens + r.completionTokens })),
      // O extrato usa o mesmo $match do resumo, então o total de registros é a contagem de requisições
      pagination: {
        page,
        limit: recentLimit,
        totalRecords: summary.requests,
        totalPages: Math.max(1, Math.ceil(summary.requests / recentLimit)),
      },
    });
  } catch (error: any) {
    return sendError(res, error, 'GET /api/finops/costs');
  }
}

// POST /api/finops/sync?full=true  (full relê todos os chats do Ágape, não só os com atividade recente)
export async function syncUsage(req: Request, res: Response) {
  try {
    const result = await syncAiUsageFromUmbler({ full: req.query.full === 'true' });
    return res.json(result);
  } catch (error: any) {
    return sendError(res, error, 'POST /api/finops/sync');
  }
}
