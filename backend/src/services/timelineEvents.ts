import { UmblerService } from './umbler.js';
import { getAttendants } from './businessConfig.js';
import { logError } from '../utils/logger.js';

// Eventos de sistema da timeline da Umbler (transferências, chat finalizado, chatbot iniciado...).
// Chegam intercalados com as mensagens, identificados pelo `_t` (ex: "MemberTransferMetadataModel"),
// e trazem só ids de atendentes, setores e etiquetas. Aqui anexamos os nomes em `names` para o
// frontend montar o texto do evento.

export const isTimelineEvent = (m: any) => typeof m?._t === 'string' && m._t.endsWith('MetadataModel');

type NameMap = Map<string, string>;

// Setores e etiquetas mudam raramente: cache em memória para não buscar a cada chat aberto.
const LOOKUP_TTL_MS = 10 * 60_000;
const lookups: Partial<Record<'sectors' | 'tags', { at: number; map: NameMap }>> = {};

async function cachedLookup(key: 'sectors' | 'tags', load: () => Promise<Array<{ id: string; name: string }>>): Promise<NameMap> {
  const hit = lookups[key];
  if (hit && Date.now() - hit.at < LOOKUP_TTL_MS) return hit.map;
  try {
    const map: NameMap = new Map((await load()).filter((x) => x?.id && x?.name).map((x) => [x.id, x.name]));
    lookups[key] = { at: Date.now(), map };
    return map;
  } catch (e) {
    // Sem os nomes o evento ainda aparece (com texto genérico); não derruba a conversa.
    logError(`Umbler timeline ${key}`, e);
    return hit?.map ?? new Map();
  }
}

async function memberNames(): Promise<NameMap> {
  try {
    return new Map((await getAttendants()).map((a) => [a.id, a.name]));
  } catch (e) {
    logError('Timeline atendentes', e);
    return new Map();
  }
}

/** Anexa `names` (atendentes, setores, etiquetas) aos eventos de sistema da timeline. Altera as entradas. */
export async function enrichTimelineEvents(entries: any[]): Promise<any[]> {
  const events = entries.filter(isTimelineEvent);
  if (events.length === 0) return entries;

  const has = (t: string) => events.some((e) => e._t === t);
  const empty: NameMap = new Map();
  const [members, sectors, tags] = await Promise.all([
    memberNames(),
    has('SectorTransferMetadataModel') ? cachedLookup('sectors', UmblerService.listSectors) : empty,
    has('TagsChangedMetadataModel') ? cachedLookup('tags', UmblerService.listTags) : empty,
  ]);
  const nameOf = (map: NameMap, id?: string | null) => (id ? map.get(id) : undefined);
  const tagNames = (ids?: string[]) => (ids || []).map((id) => tags.get(id)).filter(Boolean);

  for (const e of events) {
    const author = e.author;
    e.names = {
      author:
        author?._t === 'AgentAuthorModel' ? nameOf(members, author.agentId)
        : author?._t === 'BotAuthorModel' ? author.name
        : undefined,
      previousMember: nameOf(members, e.previousMemberId),
      newMember: nameOf(members, e.newMemberId ?? e.memberId),
      previousSector: nameOf(sectors, e.previousSectorId),
      newSector: nameOf(sectors, e.newSectorId),
      addedTags: tagNames(e.addedTagIds),
      removedTags: tagNames(e.removedTagIds),
    };
  }
  return entries;
}
