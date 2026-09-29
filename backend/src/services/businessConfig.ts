import Carteira from '../models/Carteira.js';
import Attendant from '../models/Attendant.js';

export const NO_CARTEIRA = 'Sem carteira';
const AGAPE_DISPLAY_NAME = 'Ágape (IA)';

/** ID do Ágape (membro da Umbler). Obrigatório: validado na inicialização do servidor. */
export function getAgapeMemberId(): string {
  const id = (process.env.UMBLER_AGENT_ID || '').replace(/['"]/g, '').trim();
  if (!id) throw new Error('UMBLER_AGENT_ID não configurado no backend/.env.');
  return id;
}

// Valores que estavam fixos no código até esta versão; viram o seed inicial do banco.
const DEFAULT_CARTEIRAS = ['ANTARES', 'ARCTURUS', 'ALPHA', 'SIGMA', 'SIRIUS'];
const DEFAULT_ATTENDANTS = [
  { memberId: 'Zfn4fJl90YDKSkka', name: 'Grazi' },
  { memberId: 'ZuSZZB90jnWXPdJM', name: 'Grasieli Kolaço' },
  { memberId: 'ZuSZiD4N-bRbWZZf', name: 'Brenda Prover' },
  { memberId: 'ZuSZiB90jnWXPu0V', name: 'Amanda' },
  { memberId: 'ZfnQ9OEJHZvJ95w6', name: 'Suporte' },
  { memberId: 'acpzV_4hy6-atHJl', name: 'Ana Carolina' },
];

/** Insere carteiras e atendentes padrão quando as coleções estão vazias. */
export async function seedBusinessConfig() {
  const [carteiras, attendants] = await Promise.all([Carteira.countDocuments(), Attendant.countDocuments()]);
  if (carteiras === 0) {
    await Carteira.insertMany(DEFAULT_CARTEIRAS.map((name, order) => ({ name, order })));
    console.log(`[Config] Seed: ${DEFAULT_CARTEIRAS.length} carteiras padrão inseridas.`);
  }
  if (attendants === 0) {
    const agape = { memberId: getAgapeMemberId(), name: AGAPE_DISPLAY_NAME };
    const rows = [agape, ...DEFAULT_ATTENDANTS.filter(a => a.memberId !== agape.memberId)];
    await Attendant.insertMany(rows.map((a, order) => ({ ...a, order })));
    console.log(`[Config] Seed: ${rows.length} atendentes padrão inseridos.`);
  }
  invalidateBusinessConfigCache();
}

// As listas mudam raramente e são lidas a cada polling da lista de chats: cache curto.
const CACHE_TTL_MS = 60_000;
let cache: { at: number; carteiras: string[]; attendants: Array<{ id: string; name: string }> } | null = null;

export function invalidateBusinessConfigCache() {
  cache = null;
}

async function load() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;
  const [carteiras, attendants] = await Promise.all([
    Carteira.find({ active: true }).sort({ order: 1, name: 1 }).lean(),
    Attendant.find({ active: true }).sort({ order: 1, name: 1 }).lean(),
  ]);
  cache = {
    at: Date.now(),
    carteiras: carteiras.map(c => c.name),
    attendants: attendants.map(a => ({ id: a.memberId, name: a.name })),
  };
  return cache;
}

export async function getCarteiras(): Promise<string[]> {
  return (await load()).carteiras;
}

/** Atendentes ativos, sempre com o Ágape (do .env) em primeiro. */
export async function getAttendants(): Promise<Array<{ id: string; name: string }>> {
  const agapeId = getAgapeMemberId();
  const list = (await load()).attendants;
  const agape = list.find(a => a.id === agapeId) ?? { id: agapeId, name: AGAPE_DISPLAY_NAME };
  return [agape, ...list.filter(a => a.id !== agapeId)];
}

/** Carteira do chat a partir das etiquetas; sem correspondência → "Sem carteira". */
export function resolveCarteira(tagNames: string[], carteiras: string[]): string {
  return tagNames.find(tag => carteiras.some(c => tag.toUpperCase().includes(c.toUpperCase()))) || NO_CARTEIRA;
}

/** O Ágape participou do chat (membro atual, último membro ou histórico de membros). */
export function hasAgapeInteracted(chat: any, agapeId: string): boolean {
  const members = [
    ...(chat.organizationMembers || []),
    ...(chat.organizationMemberHistory || []).map((h: any) => ({ id: h.memberId })),
  ];
  return (
    members.some((m: any) => m?.id === agapeId) ||
    chat.organizationMember?.id === agapeId ||
    chat.lastOrganizationMember?.id === agapeId
  );
}

// Detecta variantes/instâncias de teste do bot da Ágape (ex: "Teste ativo Ágape"),
// que na Umbler não compartilham o mesmo organizationMember.id da instância oficial.
export const isAgapeBotName = (botName?: string) =>
  Boolean(botName) && botName!.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('agape');
