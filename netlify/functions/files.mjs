import { store } from "../lib/common.mjs";

// GET /api/files/<id> → devolve uma imagem ou arquivo enviado
export default async (req, context) => {
  const found = await store().getWithMetadata("file/" + context.params.id, { type: "arrayBuffer" });
  if (!found) return new Response("Arquivo não encontrado", { status: 404 });
  const { name = "arquivo", type = "application/octet-stream" } = found.metadata || {};
  return new Response(found.data, {
    headers: {
      "content-type": type,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};

export const config = { path: "/api/files/:id" };

//oi