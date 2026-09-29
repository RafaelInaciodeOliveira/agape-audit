import type { Request, Response } from 'express';
import { getDb } from '../config/db.js';
import { newId } from '../utils/ids.js';
import { sendError } from '../utils/httpErrors.js';
import { parseInput, nameBodySchema } from '../validation/schemas.js';

// CRUD de motivos de falha, tópicos e subtópicos usados na classificação das auditorias.

// GET /api/fail-reasons
export async function listFailReasons(_req: Request, res: Response) {
  try {
    const db = getDb();
    const reasons = await db.collection('failReasons').find({}, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
    res.json(reasons);
  } catch (error) { sendError(res, error, 'GET /api/fail-reasons'); }
}

// POST /api/fail-reasons
export async function createFailReason(req: Request, res: Response) {
  try {
    const body = parseInput(nameBodySchema, req.body, res);
    if (!body) return;
    const { name } = body;
    const db = getDb();
    const id = newId();
    await db.collection('failReasons').insertOne({ id, name, createdAt: new Date().toISOString() });
    res.json({ id, name });
  } catch (error) { sendError(res, error, 'POST /api/fail-reasons'); }
}

// PUT /api/fail-reasons/:id
export async function renameFailReason(req: Request, res: Response) {
  try {
    const db = getDb();
    const body = parseInput(nameBodySchema, req.body, res);
    if (!body) return;
    await db.collection('failReasons').updateOne({ id: req.params.id }, { $set: { name: body.name } });
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'PUT /api/fail-reasons/:id'); }
}

// DELETE /api/fail-reasons/:id
export async function deleteFailReason(req: Request, res: Response) {
  try {
    const db = getDb();
    await db.collection('failReasons').deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'DELETE /api/fail-reasons/:id'); }
}

// GET /api/topics
export async function listTopics(_req: Request, res: Response) {
  try {
    const db = getDb();
    const topics = await db.collection('topics').find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
    const subtopics = await db.collection('subtopics').find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
    const result = topics.map((t: any) => ({ ...t, subtopics: subtopics.filter((s: any) => s.topicId === t.id) }));
    res.json(result);
  } catch (error) { sendError(res, error, 'GET /api/topics'); }
}

// POST /api/topics
export async function createTopic(req: Request, res: Response) {
  try {
    const body = parseInput(nameBodySchema, req.body, res);
    if (!body) return;
    const { name } = body;
    const db = getDb();
    const id = newId();
    await db.collection('topics').insertOne({ id, name, createdAt: new Date().toISOString() });
    res.json({ id, name, subtopics: [] });
  } catch (error) { sendError(res, error, 'POST /api/topics'); }
}

// PUT /api/topics/:id
export async function renameTopic(req: Request, res: Response) {
  try {
    const db = getDb();
    const body = parseInput(nameBodySchema, req.body, res);
    if (!body) return;
    await db.collection('topics').updateOne({ id: req.params.id }, { $set: { name: body.name } });
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'PUT /api/topics/:id'); }
}

// DELETE /api/topics/:id
export async function deleteTopic(req: Request, res: Response) {
  try {
    const db = getDb();
    await db.collection('subtopics').deleteMany({ topicId: req.params.id });
    await db.collection('topics').deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'DELETE /api/topics/:id'); }
}

// POST /api/topics/:topicId/subtopics
export async function createSubtopic(req: Request, res: Response) {
  try {
    const db = getDb();
    const body = parseInput(nameBodySchema, req.body, res);
    if (!body) return;
    const id = newId();
    await db.collection('subtopics').insertOne({ id, topicId: req.params.topicId, name: body.name, createdAt: new Date().toISOString() });
    res.json({ id, topicId: req.params.topicId, name: body.name });
  } catch (error) { sendError(res, error, 'POST /api/topics/:topicId/subtopics'); }
}

// PUT /api/subtopics/:id
export async function renameSubtopic(req: Request, res: Response) {
  try {
    const db = getDb();
    const body = parseInput(nameBodySchema, req.body, res);
    if (!body) return;
    await db.collection('subtopics').updateOne({ id: req.params.id }, { $set: { name: body.name } });
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'PUT /api/subtopics/:id'); }
}

// DELETE /api/subtopics/:id
export async function deleteSubtopic(req: Request, res: Response) {
  try {
    const db = getDb();
    await db.collection('subtopics').deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'DELETE /api/subtopics/:id'); }
}
