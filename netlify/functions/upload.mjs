import { json, isAdmin, store } from "../lib/common.mjs";

const LIMITE = 4.5 * 1024 * 1024;

// POST /api/upload → guarda uma imagem ou arquivo e devolve o endereço dele (só admin)
export default async req => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!isAdmin(req)) return json({ error: "Senha de admin incorreta." }, 401);

  const bytes = await req.arrayBuffer();
  if (!bytes.byteLength) return json({ error: "Arquivo vazio." }, 400);
  if (bytes.byteLength > LIMITE) return json({ error: "Arquivo maior que 4,5 MB." }, 413);

  const name = decodeURIComponent(req.headers.get("x-file-name") || "arquivo");
  const type = req.headers.get("content-type") || "application/octet-stream";
  const id = crypto.randomUUID();
  await store().set("file/" + id, bytes, { metadata: { name, type } });
  return json({ url: "/api/files/" + id, name, type, size: bytes.byteLength });
};

export const config = { path: "/api/upload" };