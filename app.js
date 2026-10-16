// Site-currículo do João Pedro.
// Visitantes só leem. Com ?admin no endereço (e a senha certa) aparecem os botões de editar.

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const safeUrl = u => (/^(https?:|mailto:|\/)/i.test(u || "") ? u : u ? "https://" + u : "");
// A caixa de postagem é movida para dentro da seção Novidades a cada render, então guardamos a referência.
const composerEl = document.getElementById("composer");

const ICON = {
  linkedin: '<svg viewBox="0 0 24 24"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
  github: '<svg viewBox="0 0 24 24"><path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-5-5m5 5l5-5M4 20h16"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  dot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/></svg>',
};

let data = null;
let admin = false;
let pass = "";

// ---------- Servidor ----------
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), "x-admin-password": pass } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro " + r.status);
  return j;
}

async function load() {
  try {
    data = await api("/api/data");
  } catch {
    // Sem as funções (ex.: abrindo o arquivo direto no computador): mostra os dados iniciais só para leitura.
    data = await (await fetch("/data.json")).json();
  }
  // Os dados salvos no servidor podem ser anteriores a campos novos (projetos, Instagram, qualidades):
  // completa só o que falta com o data.json, sem trocar nada que já foi editado.
  try {
    const base = await (await fetch("/data.json")).json();
    for (const k of Object.keys(base)) if (data[k] === undefined) data[k] = base[k];
    for (const k of Object.keys(base.profile || {})) if (data.profile[k] === undefined) data.profile[k] = base.profile[k];
  } catch {}
  for (const k of ["experiences", "education", "skills", "projects", "certificates", "posts"]) if (!Array.isArray(data[k])) data[k] = [];
}

async function save(msg = "Salvo") {
  try {
    data = await api("/api/data", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    toast(msg);
  } catch (e) {
    toast("Não salvou: " + e.message);
    await load();
  }
  render();
}

// Reduz imagens grandes antes de enviar. Com square=true, recorta um quadrado (foto de perfil).
function shrink(file, max, square = false) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
      const k = Math.min(1, max / Math.max(sw, sh));
      const c = document.createElement("canvas");
      c.width = Math.round(sw * k); c.height = Math.round(sh * k);
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob(b => (b ? ok(b) : fail(new Error("Imagem inválida"))), "image/jpeg", 0.86);
    };
    img.onerror = () => fail(new Error(`Não consegui abrir "${file.name}"`));
    img.src = URL.createObjectURL(file);
  });
}

async function upload(file, { square = false, max = 1800 } = {}) {
  let blob = file, name = file.name, type = file.type || "application/octet-stream";
  if (/^image\/(jpeg|png|webp|heic|heif)$/.test(type) || square) {
    blob = await shrink(file, square ? 600 : max, square);
    type = "image/jpeg";
    name = name.replace(/\.\w+$/, "") + ".jpg";
  }
  if (blob.size > 4.5 * 1024 * 1024) throw new Error(`"${file.name}" passa de 4,5 MB.`);
  return api("/api/upload", { method: "POST", headers: { "content-type": type, "x-file-name": encodeURIComponent(name) }, body: blob });
}

// ---------- Aparência ----------
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}

const range = (a, b) => [a, b].filter(Boolean).join(" – ");
const host = u => String(u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
const lines = s => String(s || "").split("\n").map(l => l.trim()).filter(Boolean);
const initials = () => (data.profile.name || "?").trim()[0] || "?";
const avatar = (cls = "mini") => `<div class="${cls} initials">${esc(initials())}</div>`;

// "123,5h" → 123.5
const hoursOf = h => parseFloat(String(h || "").replace(",", ".")) || 0;
const fmtHours = n => String(Math.round(n * 10) / 10).replace(".", ",");

// Separa as competências em grupos para o recrutador achar rápido.
const SKILL_GROUPS = [
  ["Desenvolvimento", /html|css|javascript|typescript|node|react|vue|angular|git|python|java\b|php|api|docker|linux|devops|netlify|vercel/i],
  ["Dados", /sql|mysql|postgres|banco|dados|excel|power ?bi|mongo/i],
];
function groupSkills() {
  const groups = SKILL_GROUPS.map(([name]) => ({ name, items: [] }));
  const other = { name: "Profissional", items: [] };
  data.skills.forEach((s, i) => {
    const g = SKILL_GROUPS.findIndex(([, re]) => re.test(s));
    (g >= 0 ? groups[g] : other).items.push({ s, i });
  });
  return [...groups, other].filter(g => g.items.length);
}

const linksOf = p => [
  p.linkedin && { key: "linkedin", label: "LinkedIn", url: safeUrl(p.linkedin) },
  p.github && { key: "github", label: "GitHub", url: safeUrl(p.github) },
  p.instagram && { key: "instagram", label: "Instagram", url: safeUrl(p.instagram) },
  p.email && { key: "mail", label: "E-mail", url: "mailto:" + p.email },
].filter(Boolean);

const extAttrs = url => (/^mailto:/.test(url) ? "" : ' target="_blank" rel="noopener"');

// Seções da página, na ordem do menu. "show" decide se aparece para o visitante.
const SECTIONS = [
  { id: "sobre", label: "Sobre" },
  { id: "projetos", label: "Projetos", show: () => data.projects.length },
  { id: "novidades", label: "Novidades", show: () => data.posts.length },
  { id: "skills", label: "Skills", show: () => data.skills.length },
  { id: "formacao", label: "Formação", show: () => data.education.length },
  { id: "certificados", label: "Certificados", show: () => data.certificates.length },
  { id: "experiencia", label: "Experiência", show: () => data.experiences.length },
];
const visible = s => admin || !s.show || s.show();

function renderSide() {
  const p = data.profile;
  const det = lines(p.details);
  const avail = det.find(l => /dispon/i.test(l));
  const facts = [p.city && ["pin", p.city], ...det.filter(l => l !== avail).map(l => ["dot", l])].filter(Boolean);
  const links = linksOf(p);
  $("#side").innerHTML = `
    <h1 class="name">${esc(p.name)}</h1>
    ${p.title ? `<p class="role">${esc(p.title)}</p>` : ""}
    ${avail ? `<p class="avail"><i></i>${esc(avail)}</p>` : ""}
    ${facts.length ? `<ul class="facts">${facts.map(([ic, t]) => `<li>${ICON[ic]}<span>${esc(t)}</span></li>`).join("")}</ul>` : ""}
    <nav class="nav" aria-label="Seções">${SECTIONS.filter(visible).map(s => `<a href="#${s.id}">${s.label}</a>`).join("")}</nav>
    <div class="side-foot">
      ${admin ? `<button class="soft on-dark" data-act="edit-profile">Editar perfil</button>` : ""}
      <button class="cv-btn" data-act="pdf">${ICON.download}Baixar currículo em PDF</button>
      ${links.length ? `<div class="socials">${links.map(l => `<a href="${esc(l.url)}"${extAttrs(l.url)} aria-label="${l.label}" title="${l.label}">${ICON[l.key]}</a>`).join("")}</div>` : ""}
    </div>`;
  $("#mobileBar").innerHTML = `<button class="cv-btn" data-act="pdf">${ICON.download}Currículo PDF</button>
    ${links.filter(l => l.key === "linkedin" || l.key === "github").map(l => `<a class="ic" href="${esc(l.url)}"${extAttrs(l.url)} aria-label="${l.label}">${ICON[l.key]}</a>`).join("")}`;
  const first = (p.name || "").split(" ").slice(0, 2).join(" ");
  document.title = `${first || "Portfólio"} · ${p.title || "Currículo"}`;
}

function head(title, kind, extra = "") {
  return `<div class="sec-head"><h2>${title}</h2>${extra ? `<small>${extra}</small>` : ""}${admin && kind ? `<button class="soft" data-act="add-${kind}">+ Adicionar</button>` : ""}</div>`;
}
const empty = msg => `<p class="empty">${msg}</p>`;

function aboutSec() {
  const p = data.profile;
  const [lead, ...rest] = String(p.about || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const q = lines(p.qualities).map(l => l.split("|").map(s => s.trim()));
  return `<section id="sobre">
    ${admin ? `<div class="sec-head"><h2>Sobre</h2><button class="soft" data-act="edit-profile">Editar</button></div>` : ""}
    ${lead ? `<p class="lead">${esc(lead)}</p>` : admin ? empty("Escreva um resumo em Editar perfil.") : ""}
    ${rest.map(t => `<p class="lead-more">${esc(t)}</p>`).join("")}
    ${q.length ? `<div class="qualities">${q.map(([t, d]) => `<div><h3>${esc(t)}</h3>${d ? `<p>${esc(d)}</p>` : ""}</div>`).join("")}</div>` : ""}
  </section>`;
}

function projLinks(x, cls = "links") {
  const demo = safeUrl(x.demo), repo = safeUrl(x.repo);
  if (!demo && !repo && !admin) return "";
  return `<div class="${cls}">
    ${demo ? `<a href="${esc(demo)}" target="_blank" rel="noopener">Abrir site</a>` : ""}
    ${repo ? `<a href="${esc(repo)}" target="_blank" rel="noopener">Ver código</a>` : ""}
    ${admin ? `<button class="soft" data-act="proj" data-id="${esc(x.id)}">Editar projeto</button>` : ""}
  </div>`;
}
const stackOf = x => String(x.stack || "").split(",").map(s => s.trim()).filter(Boolean);
const tags = xs => (xs.length ? `<ul class="tag-row">${xs.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : "");
const status = x => (x.status ? `<p class="state${/conclu|no ar|publicad/i.test(x.status) ? " done" : ""}"><i></i>${esc(x.status)}</p>` : "");
const highlights = x => { const hl = lines(x.highlights); return hl.length ? `<ul class="hl">${hl.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""; };

function featureCard(x) {
  const demo = safeUrl(x.demo);
  const shot = x.image?.url
    ? `<img src="${esc(x.image.url)}" alt="Tela do ${esc(x.name)}" loading="lazy">`
    : `<div class="shot-ph"><b>${esc(x.name)}</b>${demo ? `<span>${esc(host(demo))}</span>` : ""}</div>`;
  return `<article class="feature">
    <div class="browser">
      <div class="bar"><i></i><i></i><i></i>${demo ? `<span>${esc(host(demo))}</span>` : ""}</div>
      ${demo ? `<a href="${esc(demo)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${shot}</a>` : shot}
    </div>
    <div>
      <h3>${esc(x.name)}</h3>
      ${x.summary ? `<p>${esc(x.summary)}</p>` : ""}
      ${highlights(x)}
      ${tags(stackOf(x))}
      ${status(x)}
      ${projLinks(x)}
    </div>
  </article>`;
}

function projCard(x) {
  return `<article class="proj">
    ${x.image?.url ? `<a class="proj-shot" href="${esc(x.image.url)}" target="_blank" rel="noopener"><img src="${esc(x.image.url)}" alt="Tela do ${esc(x.name)}" loading="lazy"></a>` : ""}
    <h3>${esc(x.name)}</h3>
    ${x.summary ? `<p>${esc(x.summary)}</p>` : ""}
    ${highlights(x)}
    ${tags(stackOf(x))}
    ${status(x)}
    ${projLinks(x)}
  </article>`;
}

function projSec() {
  const xs = data.projects;
  const n = xs.length;
  // O projeto que está no ar vem em destaque.
  const order = [...xs].sort((a, b) => !!safeUrl(b.demo) - !!safeUrl(a.demo));
  const [top, ...rest] = order;
  return `<section id="projetos">
    ${head("Projetos", "proj", n ? `${n} projeto${n > 1 ? "s" : ""}` : "")}
    ${top ? featureCard(top) : empty("Nenhum projeto ainda.")}
    ${rest.length ? `<div class="proj-list">${rest.map(projCard).join("")}</div>` : ""}
  </section>`;
}

function fileCard(f) {
  const ext = (f.name.split(".").pop() || "arq").slice(0, 4);
  const kb = f.size ? (f.size > 1048576 ? (f.size / 1048576).toFixed(1) + " MB" : Math.round(f.size / 1024) + " KB") : "";
  return `<a class="file" href="${esc(f.url)}" target="_blank" rel="noopener" download="${esc(f.name)}">
    <div class="ext ${ext.toLowerCase() === "pdf" ? "pdf" : ""}">${esc(ext)}</div>
    <div><b>${esc(f.name)}</b><small>${[kb, "Baixar"].filter(Boolean).join(" · ")}</small></div></a>`;
}

const clean = html => (window.DOMPurify ? DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ["p", "div", "br", "b", "strong", "i", "em", "u", "s", "strike", "h2", "h3", "ul", "ol", "li", "span", "a"],
  ALLOWED_ATTR: ["class", "href", "target", "rel"],
}) : esc(new DOMParser().parseFromString(html, "text/html").body.textContent));

function when(iso) {
  const d = new Date(iso), s = (Date.now() - d) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) { const n = Math.floor(s / 86400); return `há ${n} dia${n > 1 ? "s" : ""}`; }
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

function postList() {
  if (!data.posts.length) return admin ? empty("Escreva sua primeira novidade na caixa acima.") : "";
  return data.posts.map(p => {
    const imgs = p.images || [], files = p.files || [];
    return `<article class="post" id="post-${esc(p.id)}">
      <div class="fh">${avatar()}<div><b>${esc(data.profile.name.split(" ").slice(0, 2).join(" "))}</b><small>${when(p.date)}${p.edited ? " · editado" : ""}</small></div></div>
      ${p.html ? `<div class="rich">${clean(p.html)}</div>` : ""}
      ${imgs.length ? `<div class="imgs n${Math.min(imgs.length, 4)}">${imgs.slice(0, 4).map(im => `<a href="${esc(im.url)}" target="_blank" rel="noopener"><img src="${esc(im.url)}" alt="${esc(im.name)}" loading="lazy"></a>`).join("")}</div>` : ""}
      ${files.map(fileCard).join("")}
      <div class="acts">
        <button data-act="share" data-id="${esc(p.id)}">Compartilhar</button>
        ${admin ? `<button data-act="edit-post" data-id="${esc(p.id)}">Editar</button><button data-act="del-post" data-id="${esc(p.id)}">Excluir</button>` : ""}
      </div>
    </article>`;
  }).join("");
}

function postSec() {
  return `<section id="novidades">${head("Novidades")}<div id="composerSlot"></div><div class="posts">${postList()}</div></section>`;
}

function skillSec() {
  const gs = groupSkills();
  const body = gs.length
    ? `<div class="skills">${gs.map(g => `<div><h3>${g.name}</h3><ul>${g.items.map(({ s, i }) => `<li>${esc(s)}${admin ? `<button data-act="del-skill" data-i="${i}" title="Remover" aria-label="Remover ${esc(s)}">×</button>` : ""}</li>`).join("")}</ul></div>`).join("")}</div>`
    : empty("Nenhuma competência ainda.");
  return `<section id="skills">${head("Skills", "skill")}${body}</section>`;
}

function eduSec() {
  const xs = data.education;
  const now = x => !x.end || /cursando/i.test(x.end);
  const whenTxt = x => (/cursando/i.test(x.end) || !x.end) && x.start ? `Desde ${x.start} · cursando` : x.end && !/cursando/i.test(x.end) ? `Concluído em ${x.end}` : range(x.start, x.end);
  const body = xs.length
    ? `<ol class="timeline">${xs.map(x => `<li class="${now(x) ? "now" : ""}">
        <${admin ? `button class="tl-item" data-act="edu" data-id="${esc(x.id)}"` : "div"}>
          ${whenTxt(x) ? `<div class="when">${esc(whenTxt(x))}</div>` : ""}
          <h3>${esc(x.course)}</h3>
          <p>${esc([x.institution, x.degree].filter(Boolean).join(", "))}</p>
          ${!x.end && x.note ? `<p class="note">${esc(x.note)}</p>` : ""}
        </${admin ? "button" : "div"}></li>`).join("")}</ol>`
    : empty("Nenhuma formação ainda.");
  return `<section id="formacao">${head("Formação", "edu")}${body}</section>`;
}

function certSec() {
  const xs = data.certificates;
  const total = xs.reduce((s, c) => s + hoursOf(c.hours), 0);
  const max = Math.max(1, ...xs.map(c => hoursOf(c.hours)));
  const body = xs.length
    ? `<div class="certs">${xs.map(c => {
        const h = hoursOf(c.hours);
        const tag = admin || c.file ? "button" : "div";
        return `<${tag} class="cert" data-act="cert" data-id="${esc(c.id)}">
          <b>${esc(c.name)}</b>
          ${h ? `<span class="h">${fmtHours(h)}<small>h</small></span>` : "<span></span>"}
          <span class="by">${esc([c.issuer, c.date].filter(Boolean).join(", "))}${c.file ? ` <em>Ver certificado</em>` : ""}</span>
          <span class="level" aria-hidden="true"><i style="width:${Math.max(3, (h / max) * 100)}%"></i></span>
        </${tag}>`;
      }).join("")}</div>`
    : empty("Nenhum certificado ainda.");
  const extra = xs.length ? `${xs.length} cursos${total ? `, ${fmtHours(total)} horas` : ""}` : "";
  return `<section id="certificados">${head("Certificados", "cert", extra)}${body}</section>`;
}

function expSec() {
  const xs = data.experiences;
  const body = xs.length
    ? `<div class="jobs">${xs.map(x => `<article class="job">
        <div class="when">${esc(range(x.start, x.end) || "")}</div>
        <div>
          <h3>${esc(x.role)}</h3>
          ${x.company ? `<p class="co">${esc(x.company)}</p>` : ""}
          ${x.description ? `<p>${esc(x.description)}</p>` : ""}
          ${admin ? `<button class="soft" data-act="exp" data-id="${esc(x.id)}">Editar</button>` : ""}
        </div>
      </article>`).join("")}</div>`
    : empty("Nenhuma experiência ainda.");
  return `<section id="experiencia">${head("Experiência", "exp")}${body}</section>`;
}

function contactSec() {
  const p = data.profile;
  const ch = linksOf(p).filter(l => l.key !== "instagram").map(l => l.label);
  return `<section class="contact" id="contato">
    <div><h2>Vamos conversar?</h2>${ch.length ? `<p>${esc(ch.join(", ").replace(/, ([^,]*)$/, " ou $1"))}, como preferir.</p>` : ""}</div>
    <button class="cv-btn" data-act="pdf">${ICON.download}Baixar currículo em PDF</button>
  </section>`;
}

let spy = null;
function renderView() {
  const parts = { sobre: aboutSec, projetos: projSec, novidades: postSec, skills: skillSec, formacao: eduSec, certificados: certSec, experiencia: expSec };
  $("#view").innerHTML = SECTIONS.filter(visible).map(s => parts[s.id]()).join("") + contactSec();
  const slot = $("#composerSlot");
  if (slot) slot.appendChild(composerEl);
  // Destaca no menu a seção que está na tela.
  spy?.disconnect();
  const navLinks = [...document.querySelectorAll(".nav a")];
  spy = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-35% 0px -60% 0px" });
  document.querySelectorAll("#view section[id]").forEach(s => spy.observe(s));
}

function render() {
  renderSide();
  composerEl.hidden = !admin;
  $("#adminPill").hidden = !admin;
  document.body.classList.toggle("is-admin", admin);
  renderView();
  rain.resize();
}

// ---------- Chuva fina na coluna lateral ----------
// As gotas caem devagar e, ao tocar a "superfície", abrem pequenas ondas. Sem animação para quem pede menos movimento.
const rain = (() => {
  const c = $("#rain"), g = c.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, drops = [], rings = [], running = false;
  const drop = init => ({ x: Math.random() * w, y: init ? Math.random() * h : -20 - Math.random() * h * 0.5, l: 10 + Math.random() * 18, v: 2.2 + Math.random() * 2.6, a: 0.08 + Math.random() * 0.14, floor: h * (0.55 + Math.random() * 0.45) });
  function resize() {
    const dpr = devicePixelRatio || 1;
    w = c.offsetWidth; h = c.offsetHeight;
    if (!w || !h) return;
    c.width = w * dpr; c.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drops = Array.from({ length: Math.round((w * h) / 9000) }, () => drop(true));
    rings = Array.from({ length: 6 }, () => ({ x: Math.random() * w, y: h * (0.6 + Math.random() * 0.4), r: Math.random() * 30, a: 0.25 * Math.random() }));
    if (still) frame(); else if (!running) { running = true; requestAnimationFrame(frame); }
  }
  function frame() {
    g.clearRect(0, 0, w, h);
    g.lineWidth = 1; g.lineCap = "round";
    for (const d of drops) {
      g.strokeStyle = `rgba(185,214,221,${d.a})`;
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - d.l * 0.08, d.y + d.l); g.stroke();
      if (still) continue;
      d.y += d.v; d.x -= d.v * 0.08;
      if (d.y > d.floor) { if (Math.random() < 0.35) rings.push({ x: d.x, y: d.floor, r: 1, a: 0.32 }); Object.assign(d, drop(false)); }
    }
    for (const r of rings) {
      g.strokeStyle = `rgba(185,214,221,${r.a})`;
      g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * 0.32, 0, 0, Math.PI * 2); g.stroke();
      if (r.r > 8) { g.strokeStyle = `rgba(185,214,221,${r.a * 0.6})`; g.beginPath(); g.ellipse(r.x, r.y, r.r * 0.55, r.r * 0.18, 0, 0, Math.PI * 2); g.stroke(); }
      if (!still) { r.r += 0.45; r.a -= 0.004; }
    }
    rings = rings.filter(r => r.a > 0);
    if (!still) requestAnimationFrame(frame);
  }
  addEventListener("resize", () => { clearTimeout(resize.t); resize.t = setTimeout(resize, 150); });
  return { resize };
})();

// ---------- Folhas (janelas) de edição ----------
function sheet(title, bodyHTML, { onSave, saveLabel = "Salvar", cancelLabel = "Cancelar" } = {}) {
  const bg = document.createElement("div");
  bg.className = "sheet-bg";
  bg.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}">
    <div class="sh-head"><button data-x>${onSave ? cancelLabel : ""}</button><b>${esc(title)}</b><button data-ok>${onSave ? saveLabel : "Fechar"}</button></div>
    <div class="sh-body">${bodyHTML}</div></div>`;
  const close = () => bg.remove();
  bg.addEventListener("click", e => { if (e.target === bg) close(); });
  $("[data-x]", bg).onclick = close;
  $("[data-ok]", bg).onclick = async () => {
    if (!onSave) return close();
    const btn = $("[data-ok]", bg);
    btn.disabled = true; btn.textContent = "Salvando…";
    try { if ((await onSave(bg)) !== false) close(); }
    catch (e) { toast(e.message); }
    btn.disabled = false; btn.textContent = saveLabel;
  };
  document.body.appendChild(bg);
  const first = $("input:not([type=file]), textarea", bg);
  if (first && matchMedia("(min-width: 761px)").matches) first.focus();
  return bg;
}

const field = (f, v) => f.type === "textarea"
  ? `<label class="fld"${f.onlyIfEmpty ? ` data-if-empty="${f.onlyIfEmpty}"` : ""}><span>${f.label}</span><textarea name="${f.key}" placeholder="${esc(f.ph || "")}">${esc(v)}</textarea></label>`
  : f.type === "file"
    ? `<label class="fld"><span>${f.label}</span><input type="file" name="${f.key}" accept="${f.accept || ""}">${v ? `<div class="cur">Atual: <a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.name)}</a></div>` : ""}</label>`
    : f.type === "date"
      ? `<div class="fld fld-date"><span>${f.label}</span><input name="${f.key}" value="${esc(v)}" placeholder="Toque para escolher" readonly data-cal="${f.ongoing ? "ongoing" : ""}"><div class="cal" hidden></div></div>`
    : `<label class="fld"><span>${f.label}</span><input name="${f.key}" type="${f.type || "text"}" value="${esc(v)}" placeholder="${esc(f.ph || "")}"></label>`;

// Formulário genérico para experiência, formação e certificado.
function form({ title, fields, value = {}, hint, onSave, onDelete }) {
  const bg = sheet(title,
    `<div class="group">${fields.map(f => field(f, value[f.key])).join("")}</div>${hint ? `<p class="hint">${hint}</p>` : ""}${onDelete ? `<button class="danger" data-del>Excluir</button>` : ""}`,
    {
      onSave: async bg => {
        const out = { ...value };
        for (const f of fields) {
          const el = bg.querySelector(`[name="${f.key}"]`);
          if (f.type === "file") { if (el.files[0]) { const u = await upload(el.files[0]); out[f.key] = u; } }
          else out[f.key] = el.value.trim();
        }
        for (const f of fields) {
          if (f.onlyIfEmpty && out[f.onlyIfEmpty]) out[f.key] = "";
        }
        const req = fields.find(f => f.required && !out[f.key]);
        if (req) { toast(`Preencha "${req.label}".`); return false; }
        await onSave(out);
      },
    });
  bg.querySelectorAll("[data-cal]").forEach(datePicker);
  // Campo que só aparece quando outro está vazio (ex.: descrição quando não há data de fim).
  bg.querySelectorAll("[data-if-empty]").forEach(box => {
    const other = bg.querySelector(`[name="${box.dataset.ifEmpty}"]`);
    const sync = () => { box.hidden = !!other.value.trim(); };
    other.addEventListener("input", sync);
    sync();
  });
  const del = $("[data-del]", bg);
  if (del) del.onclick = async () => { if (confirm("Excluir este item?")) { bg.remove(); await onDelete(); } };
}

// Calendário pequeno que abre embaixo dos campos de data (formato 14/09/2026).
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function datePicker(input) {
  const cal = input.parentElement.querySelector(".cal");
  const pad = n => String(n).padStart(2, "0");
  const today = new Date();
  let view;
  const parse = () => {
    const m = input.value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  };
  const draw = () => {
    const sel = parse();
    const y = view.getFullYear(), mo = view.getMonth();
    const first = new Date(y, mo, 1).getDay();
    const days = new Date(y, mo + 1, 0).getDate();
    const same = (d, a) => a && a.getFullYear() === y && a.getMonth() === mo && a.getDate() === d;
    let cells = "";
    for (let i = 0; i < first; i++) cells += "<i></i>";
    for (let d = 1; d <= days; d++)
      cells += `<button type="button" data-d="${d}" class="${same(d, sel) ? "sel" : ""} ${same(d, today) ? "hoje" : ""}">${d}</button>`;
    cal.innerHTML = `
      <div class="cal-head">
        <button type="button" data-nav="-12" aria-label="Ano anterior">«</button>
        <button type="button" data-nav="-1" aria-label="Mês anterior">‹</button>
        <b>${MESES[mo]} ${y}</b>
        <button type="button" data-nav="1" aria-label="Próximo mês">›</button>
        <button type="button" data-nav="12" aria-label="Próximo ano">»</button>
      </div>
      <div class="cal-week"><i>D</i><i>S</i><i>T</i><i>Q</i><i>Q</i><i>S</i><i>S</i></div>
      <div class="cal-days">${cells}</div>
      <div class="cal-foot">
        <button type="button" data-set="">Limpar</button>
        ${input.dataset.cal === "ongoing" ? `<button type="button" data-set="cursando">Cursando</button>` : ""}
        <button type="button" data-set="hoje">Hoje</button>
      </div>`;
  };
  const toggle = open => {
    if (open) {
      input.closest(".sheet").querySelectorAll(".cal").forEach(c => { if (c !== cal) c.hidden = true; });
      view = parse() || new Date(today.getFullYear(), today.getMonth(), 1);
      view.setDate(1);
      draw();
    }
    cal.hidden = !open;
  };
  input.addEventListener("click", () => toggle(cal.hidden));
  cal.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.nav) { view.setMonth(view.getMonth() + +b.dataset.nav); return draw(); }
    if (b.dataset.d) input.value = `${pad(b.dataset.d)}/${pad(view.getMonth() + 1)}/${view.getFullYear()}`;
    else if (b.dataset.set === "hoje") input.value = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
    else if (b.dataset.set !== undefined) input.value = b.dataset.set;
    input.dispatchEvent(new Event("input"));
    toggle(false);
  });
}

const EXP_FIELDS = [
  { key: "role", label: "Cargo", required: true, ph: "Ex.: Auxiliar Administrativo" },
  { key: "company", label: "Empresa", ph: "Nome da empresa" },
  { key: "start", label: "Início", ph: "Ex.: set 2024" },
  { key: "end", label: "Fim", ph: "Ex.: set 2025 ou o momento" },
  { key: "description", label: "O que você fazia", type: "textarea", ph: "Atividades e resultados" },
];
const EDU_FIELDS = [
  { key: "course", label: "Curso", required: true, ph: "Ex.: Análise e Desenvolvimento de Sistemas" },
  { key: "institution", label: "Instituição", ph: "Ex.: IESB" },
  { key: "degree", label: "Tipo", ph: "Ex.: Tecnólogo, Graduação, Técnico" },
  { key: "start", label: "Início", type: "date" },
  { key: "end", label: "Fim", type: "date", ongoing: true },
  { key: "note", label: "Descrição (aparece quando não há data de fim)", type: "textarea", onlyIfEmpty: "end", ph: "Ex.: Previsão de conclusão em 2027" },
];
const PROJ_FIELDS = [
  { key: "name", label: "Nome do projeto", required: true, ph: "Ex.: Gestão Financeira" },
  { key: "status", label: "Situação", ph: "Ex.: Em desenvolvimento, Concluído" },
  { key: "summary", label: "O que o projeto resolve", type: "textarea", ph: "Uma ou duas frases" },
  { key: "highlights", label: "O que você construiu (um por linha)", type: "textarea", ph: "Ex.: Cadastro de transações com categorias" },
  { key: "stack", label: "Tecnologias (separe com vírgula)", ph: "Ex.: HTML, CSS, JavaScript, Node.js" },
  { key: "demo", label: "Link do projeto no ar", type: "url" },
  { key: "repo", label: "Link do código no GitHub", type: "url" },
  { key: "image", label: "Print do projeto", type: "file", accept: "image/*" },
];
const CERT_FIELDS = [
  { key: "name", label: "Nome do curso", required: true },
  { key: "issuer", label: "Emissor", ph: "Ex.: Udemy" },
  { key: "hours", label: "Carga horária", ph: "Ex.: 40h" },
  { key: "date", label: "Data de conclusão", ph: "Ex.: mar 2025" },
  { key: "file", label: "Certificado (PDF ou imagem)", type: "file", accept: "application/pdf,image/*" },
];

function listEditor(listKey, fields, title, id) {
  const list = data[listKey];
  const item = list.find(x => x.id === id);
  form({
    title: item ? `Editar ${title}` : `Adicionar ${title}`,
    fields,
    value: item || {},
    onSave: async out => {
      if (item) Object.assign(item, out);
      else list.unshift({ id: uid(), ...out });
      await save();
    },
    onDelete: item && (async () => { data[listKey] = list.filter(x => x.id !== id); await save("Excluído"); }),
  });
}

function editProfile() {
  const p = data.profile;
  sheet("Editar perfil", `
    <div class="group">
      ${field({ key: "name", label: "Nome" }, p.name)}
      ${field({ key: "title", label: "Cargo que aparece abaixo do nome", ph: "Ex.: Desenvolvedor júnior, com base em web e banco de dados" }, p.title)}
      ${field({ key: "city", label: "Cidade", ph: "Ex.: Brasília, DF" }, p.city)}
      ${field({ key: "email", label: "E-mail", type: "email" }, p.email)}
    </div>
    <p class="hint">Informações abaixo do nome (uma por linha). A linha com "Disponível" vira o selo verde.</p>
    <div class="group" style="margin-top:6px">${field({ key: "details", label: "Dados rápidos", type: "textarea", ph: "Ex.: Disponível para início imediato" }, p.details)}</div>
    <div class="group" style="margin-top:18px">${field({ key: "about", label: "Sobre mim (o 1º parágrafo fica em destaque)", type: "textarea" }, p.about)}</div>
    <p class="hint">Qualidades em destaque: uma por linha, no formato Título | explicação.</p>
    <div class="group" style="margin-top:6px">${field({ key: "qualities", label: "Qualidades", type: "textarea", ph: "Ex.: Visão de negócio | Rotina real de faturamento e caixa" }, p.qualities)}</div>
    <div class="group" style="margin-top:18px">
      ${field({ key: "linkedin", label: "Link do LinkedIn", type: "url" }, p.linkedin)}
      ${field({ key: "github", label: "Link do GitHub", type: "url" }, p.github)}
      ${field({ key: "instagram", label: "Link do Instagram", type: "url" }, p.instagram)}
    </div>`,
    {
      onSave: async bg => {
        const out = { ...p };
        for (const k of ["name", "title", "city", "email", "details", "about", "qualities", "linkedin", "github", "instagram"]) out[k] = bg.querySelector(`[name="${k}"]`).value.trim();
        if (!out.name) { toast("Preencha o nome."); return false; }
        data.profile = out;
        await save("Perfil atualizado");
      },
    });
}

function addSkill() {
  const bg = sheet("Adicionar competência", `<div class="group">${field({ key: "skill", label: "Competência", ph: "Ex.: Excel avançado" })}</div><p class="hint">Dica: separe várias com vírgula.</p>`, {
    saveLabel: "Adicionar",
    onSave: async bg => {
      const vals = bg.querySelector("[name=skill]").value.split(",").map(s => s.trim()).filter(Boolean);
      if (!vals.length) { toast("Escreva a competência."); return false; }
      data.skills.push(...vals.filter(v => !data.skills.includes(v)));
      await save();
    },
  });
  $("[name=skill]", bg).addEventListener("keydown", e => { if (e.key === "Enter") $("[data-ok]", bg).click(); });
}

function showDetail(title, sub, text) {
  sheet(title, `<div class="detail"><small>${esc(sub)}</small>${esc(text || "")}</div>`);
}

// ---------- Caixa de postagem (estilo Notas do iPhone) ----------
const editor = $("#editor");
let attachments = []; // { file?, url?, name, type, size, preview? }
let editingId = null;

function renderAtt() {
  $("#compAtt").innerHTML = attachments.map((a, i) => `<div class="chip-file">
    ${a.type.startsWith("image/") ? `<img src="${esc(a.preview || a.url)}" alt="">` : "📎"}
    <span>${esc(a.name)}</span><button data-rm="${i}" title="Remover">×</button></div>`).join("");
}

function addFiles(list) {
  for (const f of list) attachments.push({ file: f, name: f.name, type: f.type || "application/octet-stream", size: f.size, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : "" });
  renderAtt();
}

function resetComposer() {
  editor.innerHTML = ""; attachments = []; editingId = null; renderAtt();
  $("#publish").textContent = "Publicar"; $("#cancelEdit").hidden = true;
}

function insertChecklist() {
  document.execCommand("insertHTML", false, '<ul class="check"><li><br></li></ul>');
}

$("#fmtBar").addEventListener("mousedown", e => e.preventDefault());
$("#stylesBar").addEventListener("mousedown", e => e.preventDefault());
$("#fmtBar").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  editor.focus();
  const cmd = b.dataset.cmd;
  if (cmd === "styles") { $("#stylesBar").hidden = !$("#stylesBar").hidden; b.classList.toggle("on", !$("#stylesBar").hidden); return; }
  if (cmd === "checklist") return insertChecklist();
  document.execCommand(cmd);
});
$("#stylesBar").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  editor.focus();
  if (b.dataset.block) document.execCommand("formatBlock", false, b.dataset.block);
  else document.execCommand(b.dataset.cmd);
});
editor.classList.add("rich");
editor.addEventListener("click", e => {
  const li = e.target.closest("ul.check > li");
  if (li && e.offsetX < 24) li.classList.toggle("done");
});
editor.addEventListener("paste", e => {
  // Cola só o texto, para não trazer cores e fontes de outros sites.
  if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); return; }
  e.preventDefault();
  document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
});
$("#pickImg").onchange = e => { addFiles(e.target.files); e.target.value = ""; };
$("#pickFile").onchange = e => { addFiles(e.target.files); e.target.value = ""; };
$("#compAtt").addEventListener("click", e => {
  const b = e.target.closest("[data-rm]"); if (!b) return;
  attachments.splice(+b.dataset.rm, 1); renderAtt();
});
$("#cancelEdit").onclick = resetComposer;

$("#publish").onclick = async () => {
  const html = clean(editor.innerHTML).trim();
  const hasText = editor.textContent.trim() || editor.querySelector("li");
  if (!hasText && !attachments.length) return toast("Escreva algo ou anexe um arquivo.");
  const btn = $("#publish");
  btn.disabled = true; btn.textContent = "Enviando…";
  try {
    const images = [], files = [];
    for (const a of attachments) {
      const up = a.file ? await upload(a.file) : a;
      const item = { url: up.url, name: up.name, type: up.type, size: up.size };
      (item.type.startsWith("image/") ? images : files).push(item);
    }
    const post = { html: hasText ? html : "", images, files };
    const old = editingId && data.posts.find(p => p.id === editingId);
    if (old) Object.assign(old, post, { edited: true });
    else data.posts.unshift({ id: uid(), date: new Date().toISOString(), ...post });
    resetComposer();
    await save(old ? "Post atualizado" : "Publicado");
  } catch (e) {
    toast(e.message);
  }
  btn.disabled = false;
  btn.textContent = editingId ? "Salvar alterações" : "Publicar";
};

function editPost(id) {
  const p = data.posts.find(x => x.id === id); if (!p) return;
  editingId = id;
  editor.innerHTML = clean(p.html || "");
  attachments = [...(p.images || []), ...(p.files || [])].map(x => ({ ...x }));
  renderAtt();
  $("#publish").textContent = "Salvar alterações"; $("#cancelEdit").hidden = false;
  composerEl.scrollIntoView({ behavior: "smooth", block: "center" });
  editor.focus();
}

// ---------- PDF do currículo ----------
function loadScript(src) {
  return new Promise((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => fail(new Error("Não consegui carregar o gerador de PDF."));
    document.head.appendChild(s);
  });
}

async function pdf() {
  toast("Gerando PDF…");
  await loadScript("/vendor/jspdf.umd.min.js");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const p = data.profile;
  const M = 18, W = 210 - 2 * M, BOTTOM = 297 - 16;
  const NAVY = [18, 49, 59], GRAY = [74, 98, 106], TXT = [30, 40, 45], LINK = [47, 111, 126];
  let y = M;
  // As fontes padrão do PDF não têm emojis: troca alguns símbolos e remove o resto.
  const txt = s => String(s || "").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/•/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "").replace(/[ \t]+/g, " ").trim();
  const need = h => { if (y + h > BOTTOM) { doc.addPage(); y = M; } };
  const write = (s, { size = 10, style = "normal", color = TXT, x = M, w = W, after = 1.2 } = {}) => {
    s = txt(s); if (!s) return;
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
    const lh = size * 0.3528 * 1.4;
    for (const para of s.split("\n")) {
      for (const line of doc.splitTextToSize(para.trim() || " ", w)) { need(lh); doc.text(line, x, y + size * 0.3528); y += lh; }
    }
    y += after;
  };
  const heading = t => {
    need(16); y += 4;
    write(t.toUpperCase(), { size: 11, style: "bold", color: NAVY, after: 0 });
    doc.setDrawColor(143, 179, 188); doc.setLineWidth(0.5); doc.line(M, y, M + W, y); y += 4;
  };

  // Cabeçalho (sem foto: só o que interessa ao recrutador)
  write(p.name, { size: 20, style: "bold", color: NAVY, after: 0.5 });
  write([p.title, p.city].filter(Boolean).join("  |  "), { size: 11, color: GRAY, after: 1 });
  write([p.email, ...(p.details || "").split("\n")].filter(l => txt(l)).join("\n"), { size: 9.5, after: 0.5 });
  write([p.linkedin && "LinkedIn: " + p.linkedin.replace(/^https?:\/\/(www\.)?/, ""), p.github && "GitHub: " + p.github.replace(/^https?:\/\/(www\.)?/, ""), "Portfólio: " + location.host].filter(Boolean).join("   "), { size: 9.5, color: LINK });

  if (txt(p.about)) { heading("Resumo profissional"); write(p.about, { after: 2 }); }

  if (data.projects?.length) {
    heading("Projetos");
    for (const x of data.projects) {
      need(14);
      write([x.name, x.status && `(${x.status})`].filter(Boolean).join(" "), { size: 11, style: "bold", after: 0.5 });
      if (x.stack) write(x.stack, { size: 9.5, color: GRAY, after: 0.8 });
      write(x.summary, { after: 0.8 });
      for (const h of String(x.highlights || "").split("\n").filter(l => l.trim())) write("- " + h.trim(), { after: 0.3 });
      write([x.demo && "Projeto: " + x.demo.replace(/^https?:\/\//, ""), x.repo && "Código: " + x.repo.replace(/^https?:\/\//, "")].filter(Boolean).join("   "), { size: 9.5, color: LINK, after: 3 });
      y += 1;
    }
  }

  if (data.experiences.length) {
    heading("Experiência profissional");
    for (const e of data.experiences) {
      need(14);
      write(e.role, { size: 11, style: "bold", after: 0 });
      write([e.company, range(e.start, e.end)].filter(Boolean).join("  |  "), { size: 9.5, color: GRAY, after: 0.8 });
      write(e.description, { after: 3 });
    }
  }
  if (data.education.length) {
    heading("Formação acadêmica");
    for (const e of data.education) {
      need(10);
      write(e.course, { size: 11, style: "bold", after: 0 });
      write([e.institution, e.degree, range(e.start, e.end)].filter(Boolean).join("  |  "), { size: 9.5, color: GRAY, after: !e.end && e.note ? 0.5 : 2.5 });
      if (!e.end && e.note) write(e.note, { size: 9.5, color: GRAY, after: 2.5 });
    }
  }
  if (data.skills.length) { heading("Competências"); write(data.skills.map(txt).join("   -   "), { after: 2 }); }
  if (data.certificates.length) {
    heading("Cursos e certificados");
    for (const c of data.certificates) write("- " + [c.name, c.issuer, c.hours, c.date].filter(Boolean).join("  |  "), { after: 0.6 });
  }

  const file = "Curriculo_" + txt(p.name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\W+/g, "_") + ".pdf";
  doc.save(file);
}

// ---------- Cliques ----------
document.addEventListener("click", async e => {
  const a = e.target.closest("[data-act]"); if (!a) return;
  const { act, id } = a.dataset;
  if (act === "pdf") return pdf().catch(err => toast(err.message));
  if (act === "share") {
    const url = location.origin + "/#post-" + id;
    if (navigator.share) return navigator.share({ url }).catch(() => {});
    await navigator.clipboard?.writeText(url); return toast("Link copiado");
  }
  if (act === "exp") {
    const x = data.experiences.find(v => v.id === id);
    return admin ? listEditor("experiences", EXP_FIELDS, "experiência", id) : showDetail(x.role, [x.company, range(x.start, x.end)].filter(Boolean).join(" · "), x.description);
  }
  if (act === "edu") { if (admin) listEditor("education", EDU_FIELDS, "formação", id); return; }
  if (act === "cert") {
    const c = data.certificates.find(v => v.id === id);
    if (admin) return listEditor("certificates", CERT_FIELDS, "certificado", id);
    if (c.file) window.open(c.file.url, "_blank", "noopener");
    return;
  }
  if (!admin) return;
  if (act === "edit-profile") return editProfile();
  if (act === "add-exp") return listEditor("experiences", EXP_FIELDS, "experiência");
  if (act === "add-edu") return listEditor("education", EDU_FIELDS, "formação");
  if (act === "add-cert") return listEditor("certificates", CERT_FIELDS, "certificado");
  if (act === "add-proj") return listEditor("projects", PROJ_FIELDS, "projeto");
  if (act === "proj") return listEditor("projects", PROJ_FIELDS, "projeto", id);
  if (act === "add-skill") return addSkill();
  if (act === "del-skill") { const i = +a.dataset.i; if (confirm(`Remover "${data.skills[i]}"?`)) { data.skills.splice(i, 1); await save("Removido"); } return; }
  if (act === "edit-post") return editPost(id);
  if (act === "del-post") { if (confirm("Excluir este post?")) { data.posts = data.posts.filter(p => p.id !== id); if (editingId === id) resetComposer(); await save("Post excluído"); } }
});

$("#adminPill").onclick = () => {
  if (!confirm("Sair do modo admin neste navegador?")) return;
  localStorage.removeItem("adminPass");
  location.href = "/";
};

// ---------- Entrada no modo admin ----------
async function tryLogin(p) {
  pass = p;
  try { await api("/api/login", { method: "POST" }); return true; }
  catch { pass = ""; return false; }
}

function askPassword() {
  const bg = sheet("Entrar como admin", `<div class="group">${field({ key: "pw", label: "Senha", type: "password" })}</div>`, {
    saveLabel: "Entrar",
    onSave: async bg => {
      const p = bg.querySelector("[name=pw]").value;
      if (!(await tryLogin(p))) { toast("Senha incorreta."); return false; }
      try { localStorage.setItem("adminPass", p); } catch {}
      admin = true; render(); toast("Modo admin ativado");
    },
  });
  $("[name=pw]", bg).addEventListener("keydown", e => { if (e.key === "Enter") $("[data-ok]", bg).click(); });
}

(async () => {
  await load();
  render();
  if (new URLSearchParams(location.search).has("admin")) {
    let saved = "";
    try { saved = localStorage.getItem("adminPass") || ""; } catch {}
    if (saved && (await tryLogin(saved))) { admin = true; render(); }
    else askPassword();
  }
  if (location.hash.startsWith("#post-")) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "center" });
})();
