/**
 * Corrige o `createdAt` de auditorias antigas que foi sobrescrito a cada edição.
 *
 * O `_id` (ObjectId) é gerado na primeira inserção do documento, então o timestamp
 * embutido nele é a data real em que a auditoria foi criada. O `createdAt` atual
 * (que na prática era "data da última edição") vira `updatedAt` quando ainda não existe.
 *
 * Uso (dentro de backend/):
 *   npm run fix-dates              → simulação: só mostra o que mudaria
 *   npm run fix-dates -- --apply   → grava as correções
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, getDb } from '../src/config/db.js';

dotenv.config();

const COLLECTIONS = ['audits', 'messageAudits'] as const;
const APPLY = process.argv.includes('--apply');
const TOLERANCE_MS = 1000;
const BATCH = 500;

interface Stats {
  total: number;
  fixed: number;
  alreadyOk: number;
  skippedNoObjectId: number;
  skippedIdAfterCreatedAt: number;
}

function objectIdTime(id: unknown): Date | null {
  const getTimestamp = (id as { getTimestamp?: () => Date } | null)?.getTimestamp;
  return typeof getTimestamp === 'function' ? getTimestamp.call(id) : null;
}

async function fixCollection(name: (typeof COLLECTIONS)[number]): Promise<Stats> {
  const col = getDb().collection(name);
  const stats: Stats = { total: 0, fixed: 0, alreadyOk: 0, skippedNoObjectId: 0, skippedIdAfterCreatedAt: 0 };
  const samples: string[] = [];
  let ops: mongoose.mongo.AnyBulkWriteOperation[] = [];

  const flush = async () => {
    if (APPLY && ops.length) await col.bulkWrite(ops, { ordered: false });
    ops = [];
  };

  for await (const doc of col.find({}, { projection: { _id: 1, createdAt: 1, updatedAt: 1 } })) {
    stats.total++;
    const insertedAt = objectIdTime(doc._id);
    if (!insertedAt) { stats.skippedNoObjectId++; continue; }

    const current = doc.createdAt ? new Date(doc.createdAt) : null;
    const currentMs = current && !isNaN(current.getTime()) ? current.getTime() : null;

    if (currentMs !== null && Math.abs(currentMs - insertedAt.getTime()) <= TOLERANCE_MS) {
      stats.alreadyOk++;
      continue;
    }
    // A sobrescrita só empurrava o createdAt para frente. Se o _id é mais novo que o
    // createdAt, o documento veio de outra origem (ex.: importação) — não mexe.
    if (currentMs !== null && insertedAt.getTime() > currentMs) {
      stats.skippedIdAfterCreatedAt++;
      continue;
    }

    const set: Record<string, string> = { createdAt: insertedAt.toISOString() };
    if (!doc.updatedAt) set.updatedAt = current ? current.toISOString() : insertedAt.toISOString();
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
    stats.fixed++;
    if (samples.length < 5) samples.push(`  ${String(doc._id)}: ${doc.createdAt ?? '(vazio)'} → ${set.createdAt}`);
    if (ops.length >= BATCH) await flush();
  }
  await flush();

  console.log(`\n[${name}] ${stats.total} documentos`);
  console.log(`  ${APPLY ? 'corrigidos' : 'a corrigir'}: ${stats.fixed}`);
  console.log(`  já corretos: ${stats.alreadyOk}`);
  if (stats.skippedNoObjectId) console.log(`  ignorados (_id não é ObjectId): ${stats.skippedNoObjectId}`);
  if (stats.skippedIdAfterCreatedAt) console.log(`  ignorados (_id mais novo que createdAt): ${stats.skippedIdAfterCreatedAt}`);
  if (samples.length) console.log(`  exemplos:\n${samples.join('\n')}`);
  return stats;
}

async function main() {
  await connectDatabase();
  console.log(APPLY ? '⚠️  Modo --apply: as correções serão gravadas.' : 'Simulação (nada será gravado). Use --apply para gravar.');
  let fixed = 0;
  for (const name of COLLECTIONS) fixed += (await fixCollection(name)).fixed;
  console.log(`\n${APPLY ? '✅ Concluído' : 'ℹ️  Simulação concluída'}: ${fixed} documento(s) ${APPLY ? 'corrigido(s)' : 'seriam corrigidos'}.`);
}

main()
  .catch((err) => {
    console.error('❌ Falha ao corrigir datas:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
