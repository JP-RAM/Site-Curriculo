import { getStore } from "@netlify/blobs";

// Tudo do site fica no Netlify Blobs:
// "data" guarda perfil, experiências, formação, competências, certificados e posts;
// cada imagem ou arquivo enviado fica separado em "file/<id>".
export const store = () => getStore({ name: "curriculo", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// Confere a senha de admin enviada pelo navegador no cabeçalho x-admin-password.
export function isAdmin(req) {
  const senha = Netlify.env.get("ADMIN_PASSWORD");
  return Boolean(senha) && req.headers.get("x-admin-password") === senha;
}

export async function readData(req) {
  const saved = await store().get("data", { type: "json" });
  if (saved) return saved;
  // Primeira vez: usa o data.json publicado junto com o site como ponto de partida.
  const r = await fetch(new URL("/data.json", req.url));
  const data = await r.json();
  await store().setJSON("data", data);
  return data;
}

export const writeData = data => store().setJSON("data", data);

// Lista todos os arquivos enviados que os dados ainda usam.
export const fileIds = data =>
  new Set([...JSON.stringify(data).matchAll(/\/api\/files\/([\w-]+)/g)].map(m => m[1]));