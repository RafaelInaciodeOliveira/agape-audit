// ID curto usado nos documentos da aplicação (campo `id`, além do `_id` do Mongo).
export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
