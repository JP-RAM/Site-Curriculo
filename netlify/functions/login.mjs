import { json, isAdmin } from "../lib/common.mjs";

// POST /api/login → confere a senha de admin
export default async req => (isAdmin(req) ? json({ ok: true }) : json({ error: "Senha incorreta." }, 401));

export const config = { path: "/api/login" };