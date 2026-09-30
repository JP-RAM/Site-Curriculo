import { json, isAdmin, readData, writeData, fileIds, store } from "../lib/common.mjs";

// GET /api/data → todos os dados do site (qualquer pessoa)
// PUT /api/data → salva os dados (só admin)
export default async req => {
  if (req.method === "GET") return json(await readData(req));
  if (req.method !== "PUT") return json({ error: "Método não permitido." }, 405);
  if (!isAdmin(req)) return json({ error: "Senha de admin incorreta." }, 401);

  const next = await req.json().catch(() => null);
  if (!next?.profile || !Array.isArray(next.posts)) return json({ error: "Dados inválidos." }, 400);

  // Apaga os arquivos que deixaram de ser usados (post ou certificado excluído, foto trocada).
  const before = fileIds(await readData(req));
  const after = fileIds(next);
  for (const id of before) if (!after.has(id)) await store().delete("file/" + id);

  await writeData(next);
  return json(next);
};

export const config = { path: "/api/data" };