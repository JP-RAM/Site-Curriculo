// Site-currículo do João Pedro.
// Visitantes só leem. Com ?admin no endereço (e a senha certa) aparecem os botões de editar.

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const safeUrl = u => (/^(https?:|mailto:|\/)/i.test(u || "") ? u : u ? "https://" + u : "");

const ICON = {
  linkedin: '<svg viewBox="0 0 24 24"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
  github: '<svg viewBox="0 0 24 24"><path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>',
};
const COLORS = ["#2b6cb0", "#2f855a", "#b7791f", "#805ad5", "#c05621", "#2c7a7b"];
const EXP_ICONS = ["💼", "🤝", "🛍", "📦", "🧾", "🏢"];

let data = null;
let admin = false;
let pass = "";
let tab = "feed";

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

const avatar = (cls = "av") =>
  data.profile.photo
    ? `<img class="${cls}" src="${esc(data.profile.photo)}" alt="Foto de ${esc(data.profile.name)}">`
    : `<div class="${cls} initials">${esc((data.profile.name || "?").trim()[0] || "?")}</div>`;

const range = (a, b) => [a, b].filter(Boolean).join(" – ");

function renderHero() {
  const p = data.profile;
  const details = [p.email && `✉️ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`, ...String(p.details || "").split("\n").filter(l => l.trim()).map(esc)]
    .filter(Boolean).map(l => `<div>${l}</div>`).join("");
  $("#hero").innerHTML = `
    ${avatar()}
    <div class="hero-main">
      <h1>${esc(p.name)}</h1>
      <p class="sub">${esc([p.title, p.city].filter(Boolean).join(" · "))}</p>
      ${details ? `<div class="details">${details}</div>` : ""}
      <div class="links">
        ${p.linkedin ? `<a class="lk li" href="${esc(safeUrl(p.linkedin))}" target="_blank" rel="noopener">${ICON.linkedin}LinkedIn</a>` : ""}
        ${p.github ? `<a class="lk gh" href="${esc(safeUrl(p.github))}" target="_blank" rel="noopener">${ICON.github}GitHub</a>` : ""}
        <button class="lk cv" data-act="pdf">📄 Baixar currículo</button>
      </div>
    </div>
    ${admin ? `<button class="soft edit-profile" data-act="edit-profile">✏️ Editar perfil</button>` : ""}`;
  const first = (p.name || "").split(" ").slice(0, 2).join(" ");
  $("#barName").textContent = first || "Currículo";
  document.title = `${first || "Currículo"} · Currículo`;
  $("#compAvatar").src = p.photo || "";
}

function section(title, kind, body, isEmpty) {
  if (isEmpty && !admin) return "";
  return `<div>
    <div class="sech"><span>${title}</span>${admin ? `<button data-act="add-${kind}">+ Adicionar</button>` : ""}</div>
    ${body}
  </div>`;
}

function expList() {
  const xs = data.experiences;
  const body = xs.length
    ? xs.map((x, i) => `<button class="it" data-act="exp" data-id="${esc(x.id)}">
        <div class="ic" style="background:${COLORS[i % COLORS.length]}">${EXP_ICONS[i % EXP_ICONS.length]}</div>
        <div><b>${esc(x.role)}</b><small>${esc([x.company, range(x.start, x.end)].filter(Boolean).join(" · "))}</small></div>
        <span class="ch">›</span></button>`).join("")
    : `<div class="empty">Nenhuma experiência ainda.</div>`;
  return section("Experiência", "exp", `<div class="card list">${body}</div>`, !xs.length);
}

function eduList() {
  const xs = data.education;
  const body = xs.length
    ? xs.map((x, i) => `<button class="it" data-act="edu" data-id="${esc(x.id)}">
        <div class="ic" style="background:${["#c53030", "#dd6b20", "#2b6cb0", "#2f855a"][i % 4]}">🎓</div>
        <div><b>${esc(x.course)}</b><small>${esc([x.institution, x.degree, range(x.start, x.end)].filter(Boolean).join(" · "))}</small>${!x.end && x.note ? `<small class="note">${esc(x.note)}</small>` : ""}</div>
        ${admin ? `<span class="ch">›</span>` : ""}</button>`).join("")
    : `<div class="empty">Nenhuma formação ainda.</div>`;
  return section("Formação", "edu", `<div class="card list">${body}</div>`, !xs.length);
}

function skillList() {
  const xs = data.skills;
  const body = xs.length
    ? xs.map((s, i) => `<span class="chip">${esc(s)}${admin ? `<button data-act="del-skill" data-i="${i}" title="Remover">×</button>` : ""}</span>`).join("")
    : `<span class="empty" style="padding:0">Nenhuma competência ainda.</span>`;
  return section("Competências", "skill", `<div class="card chips">${body}</div>`, !xs.length);
}

function fileCard(f) {
  const ext = (f.name.split(".").pop() || "arq").slice(0, 4);
  const kb = f.size ? (f.size > 1048576 ? (f.size / 1048576).toFixed(1) + " MB" : Math.round(f.size / 1024) + " KB") : "";
  return `<a class="file" href="${esc(f.url)}" target="_blank" rel="noopener" download="${esc(f.name)}">
    <div class="ext ${ext.toLowerCase() === "pdf" ? "pdf" : ""}">${esc(ext)}</div>
    <div><b>${esc(f.name)}</b><small>${[kb, "Toque para baixar"].filter(Boolean).join(" · ")}</small></div></a>`;
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
  if (!data.posts.length) return `<div class="card empty">${admin ? "Escreva seu primeiro post na caixa lá em cima." : "Nenhuma publicação ainda."}</div>`;
  return data.posts.map(p => {
    const imgs = p.images || [], files = p.files || [];
    return `<article class="card post" id="post-${esc(p.id)}">
      <div class="fh">${avatar("mini")}<div><b>${esc(data.profile.name.split(" ").slice(0, 2).join(" "))}</b><small>${when(p.date)}${p.edited ? " · editado" : ""}</small></div></div>
      ${p.html ? `<div class="rich">${clean(p.html)}</div>` : ""}
      ${imgs.length ? `<div class="imgs n${Math.min(imgs.length, 4)}">${imgs.slice(0, 4).map(im => `<a href="${esc(im.url)}" target="_blank" rel="noopener"><img src="${esc(im.url)}" alt="${esc(im.name)}" loading="lazy"></a>`).join("")}</div>` : ""}
      ${files.map(fileCard).join("")}
      <div class="acts">
        <button data-act="share" data-id="${esc(p.id)}">🔗 Compartilhar</button>
        ${admin ? `<button data-act="edit-post" data-id="${esc(p.id)}">✏️ Editar</button><button data-act="del-post" data-id="${esc(p.id)}">🗑 Excluir</button>` : ""}
      </div>
    </article>`;
  }).join("");
}

function certGrid() {
  const cards = data.certificates.map((c, i) => `<button class="cert g${i % 6}" data-act="cert" data-id="${esc(c.id)}">
      <small>${esc([c.issuer, c.hours].filter(Boolean).join(" · "))}</small>
      <b>${esc(c.name)}</b>
      <em>${c.file ? "📄 Ver certificado" : esc(c.date || "")}</em></button>`).join("");
  const add = admin ? `<button class="cert add" data-act="add-cert">+ Adicionar certificado</button>` : "";
  if (!cards && !add) return `<div class="card empty">Nenhum certificado ainda.</div>`;
  return `<div class="certs">${add}${cards}</div>`;
}

function contactList() {
  const p = data.profile;
  const rows = [
    p.email && `<a class="it" href="mailto:${esc(p.email)}"><div class="ic" style="background:#2b6cb0">✉️</div><div><b>E-mail</b><small>${esc(p.email)}</small></div><span class="ch">›</span></a>`,
    p.linkedin && `<a class="it" href="${esc(safeUrl(p.linkedin))}" target="_blank" rel="noopener"><div class="ic" style="background:#0a66c2">${ICON.linkedin}</div><div><b>LinkedIn</b><small>${esc(p.linkedin.replace(/^https?:\/\/(www\.)?/, ""))}</small></div><span class="ch">›</span></a>`,
    p.github && `<a class="it" href="${esc(safeUrl(p.github))}" target="_blank" rel="noopener"><div class="ic" style="background:#24292f">${ICON.github}</div><div><b>GitHub</b><small>${esc(p.github.replace(/^https?:\/\/(www\.)?/, ""))}</small></div><span class="ch">›</span></a>`,
    `<button class="it" data-act="pdf"><div class="ic" style="background:#2f855a">📄</div><div><b>Baixar currículo</b><small>PDF sempre atualizado</small></div><span class="ch">›</span></button>`,
  ].filter(Boolean).join("");
  return `<div style="max-width:560px"><div class="sech"><span>Contato</span></div><div class="card list">${rows}</div></div>`;
}

function renderView() {
  const v = $("#view");
  if (tab === "feed") v.innerHTML = `<div class="cols"><div class="stack"><div>${postList()}</div>${expList()}</div><div class="stack">${eduList()}${skillList()}</div></div>`;
  if (tab === "cv") v.innerHTML = `<div class="cols"><div class="stack">${data.profile.about || admin ? `<div><div class="sech"><span>Sobre</span>${admin ? `<button data-act="edit-profile">Editar</button>` : ""}</div><div class="card about">${esc(data.profile.about || "Escreva um resumo em Editar perfil.")}</div></div>` : ""}${expList()}</div><div class="stack">${eduList()}${skillList()}</div></div>`;
  if (tab === "certs") v.innerHTML = certGrid();
  if (tab === "contact") v.innerHTML = contactList();
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
}

function render() {
  renderHero();
  $("#composer").hidden = !admin;
  $("#adminPill").hidden = !admin;
  renderView();
}

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
  let photoFile = null;
  const bg = sheet("Editar perfil", `
    <div class="photo-pick">${avatar()}<label class="soft">Trocar foto<input type="file" accept="image/*" hidden data-photo></label></div>
    <div class="group">
      ${field({ key: "name", label: "Nome" }, p.name)}
      ${field({ key: "title", label: "Profissão / título", ph: "Ex.: Desenvolvedor Web Júnior" }, p.title)}
      ${field({ key: "city", label: "Cidade", ph: "Ex.: Brasília, DF" }, p.city)}
      ${field({ key: "email", label: "E-mail", type: "email" }, p.email)}
    </div>
    <p class="hint">Informações abaixo do nome (uma por linha):</p>
    <div class="group" style="margin-top:6px">${field({ key: "details", label: "Dados pessoais", type: "textarea", ph: "Ex.: Disponível para início imediato" }, p.details)}</div>
    <div class="group" style="margin-top:18px">${field({ key: "about", label: "Sobre mim", type: "textarea" }, p.about)}</div>
    <div class="group" style="margin-top:18px">
      ${field({ key: "linkedin", label: "Link do LinkedIn", type: "url" }, p.linkedin)}
      ${field({ key: "github", label: "Link do GitHub", type: "url" }, p.github)}
    </div>`,
    {
      onSave: async bg => {
        const out = { ...p };
        for (const k of ["name", "title", "city", "email", "details", "about", "linkedin", "github"]) out[k] = bg.querySelector(`[name="${k}"]`).value.trim();
        if (!out.name) { toast("Preencha o nome."); return false; }
        if (photoFile) out.photo = (await upload(photoFile, { square: true })).url;
        data.profile = out;
        await save("Perfil atualizado");
      },
    });
  $("[data-photo]", bg).onchange = e => {
    photoFile = e.target.files[0];
    if (photoFile) $(".photo-pick .av", bg).outerHTML = `<img class="av" src="${URL.createObjectURL(photoFile)}" alt="">`;
  };
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
    tab = "feed";
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
  $("#composer").scrollIntoView({ behavior: "smooth", block: "center" });
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

async function toDataURL(url) {
  const b = await (await fetch(url)).blob();
  return new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
}

async function pdf() {
  toast("Gerando PDF…");
  await loadScript("/vendor/jspdf.umd.min.js");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const p = data.profile;
  const M = 18, W = 210 - 2 * M, BOTTOM = 297 - 16;
  const NAVY = [15, 27, 45], GRAY = [90, 100, 115], TXT = [35, 40, 48];
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
    doc.setDrawColor(91, 157, 255); doc.setLineWidth(0.5); doc.line(M, y, M + W, y); y += 4;
  };

  // Cabeçalho
  let x = M, hw = W;
  if (p.photo) {
    try {
      const img = await toDataURL(p.photo);
      doc.addImage(img, img.includes("image/png") ? "PNG" : "JPEG", M, y, 28, 28);
      x = M + 34; hw = W - 34;
    } catch {}
  }
  const top = y;
  write(p.name, { size: 20, style: "bold", color: NAVY, x, w: hw, after: 0.5 });
  write([p.title, p.city].filter(Boolean).join("  |  "), { size: 11, color: GRAY, x, w: hw, after: 1 });
  write([p.email, ...(p.details || "").split("\n")].filter(l => txt(l)).join("\n"), { size: 9.5, x, w: hw, after: 0.5 });
  write([p.linkedin && "LinkedIn: " + p.linkedin.replace(/^https?:\/\/(www\.)?/, ""), p.github && "GitHub: " + p.github.replace(/^https?:\/\/(www\.)?/, "")].filter(Boolean).join("   "), { size: 9.5, color: [10, 102, 194], x, w: hw });
  if (x !== M) y = Math.max(y, top + 30);

  if (txt(p.about)) { heading("Resumo profissional"); write(p.about, { after: 2 }); }

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
  const t = e.target.closest("[data-tab]");
  if (t) { tab = t.dataset.tab; renderView(); return; }
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
    else showDetail(c.name, [c.issuer, c.hours, c.date].filter(Boolean).join(" · "), "");
    return;
  }
  if (!admin) return;
  if (act === "edit-profile") return editProfile();
  if (act === "add-exp") return listEditor("experiences", EXP_FIELDS, "experiência");
  if (act === "add-edu") return listEditor("education", EDU_FIELDS, "formação");
  if (act === "add-cert") return listEditor("certificates", CERT_FIELDS, "certificado");
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
  if (location.hash.startsWith("#post-")) tab = "feed";
  render();
  if (new URLSearchParams(location.search).has("admin")) {
    let saved = "";
    try { saved = localStorage.getItem("adminPass") || ""; } catch {}
    if (saved && (await tryLogin(saved))) { admin = true; render(); }
    else askPassword();
  }
  if (location.hash.startsWith("#post-")) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "center" });
})();
