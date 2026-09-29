import type { Request, Response } from 'express';
import { sendError } from '../utils/httpErrors.js';
import { getAgapeMemberId, getAttendants, getCarteiras } from '../services/businessConfig.js';

// Configurações lidas pelo frontend (Ágape, atendentes, carteiras, base padrão).

// GET /api/config
export async function getConfig(_req: Request, res: Response) {
  try {
    res.json({
      agapeMemberId: getAgapeMemberId(),
      attendants: await getAttendants(),
      carteiras: await getCarteiras(),
      defaultKnowledgeBaseId: process.env.UMBLER_KB_ID,
    });
  } catch (error) {
    return sendError(res, error, 'GET /api/config');
  }
}
