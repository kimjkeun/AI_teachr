/* 수요 AI 에이전트 빌더스 · 강의자료 채팅
   사용: <script src="../assets/chat.js" data-room="01" defer></script>
   설문과 같은 Apps Script 웹 앱에 저장합니다(apps-script.gs의 채팅 부분). */
(() => {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzBzOWLDKIdaii6RfsVCCfTP_Y6iZdXvEomOXg24KZXOLiCLfA1CleFa_nKMykmwf91/exec";
  const LABEL = (document.currentScript && document.currentScript.dataset.room) || "00";
  // 시트가 '01'을 숫자 1로 바꾸지 않도록 글자를 붙인 방 이름을 씀
  const ROOM = "lesson" + LABEL;
  const OPEN_MS = 5000, CLOSED_MS = 30000;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };
  const K = { name: "wab-chat-name", admin: "wab-chat-admin", seen: "wab-chat-seen-" + ROOM };

  /* ---------- 화면 ---------- */
  const fab = el("button", "chat-fab"); fab.type = "button"; fab.setAttribute("aria-expanded", "false");
  fab.append(el("span", null, "💬 채팅"), el("b", "chat-badge"));
  const badge = fab.querySelector(".chat-badge"); badge.hidden = true;

  const panel = el("aside", "chat-panel"); panel.hidden = true; panel.setAttribute("aria-label", "강의자료 채팅");
  const head = el("div", "chat-head");
  const title = el("div"); title.append(el("b", null, "같이 보는 채팅"), el("small", null, "강의자료 " + LABEL + " · 공지와 복사용 명령도 여기에"));
  const close = el("button", "chat-x", "✕"); close.type = "button"; close.setAttribute("aria-label", "채팅 닫기");
  head.append(title, close);
  const pinned = el("div", "chat-pinned");
  const list = el("div", "chat-list"); list.setAttribute("aria-live", "polite");
  const status = el("p", "chat-status");

  const form = el("form", "chat-form");
  const nameRow = el("div", "chat-name");
  const nameIn = el("input"); nameIn.type = "text"; nameIn.maxLength = 20; nameIn.placeholder = "이름 (예: 김선생)"; nameIn.setAttribute("aria-label", "이름");
  const ta = el("textarea"); ta.rows = 1; ta.maxLength = 1000; ta.placeholder = "메시지 (Enter 전송 · Shift+Enter 줄바꿈)"; ta.setAttribute("aria-label", "메시지");
  const opts = el("div", "chat-opts");
  const kindSel = el("select"); kindSel.setAttribute("aria-label", "보내는 형식");
  [["msg", "💬 메시지"], ["code", "⌨️ 복사용 블록"], ["notice", "📌 공지"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; kindSel.append(o); });
  const send = el("button", "btn chat-send", "보내기"); send.type = "submit";
  nameRow.append(nameIn, kindSel);
  opts.append(ta, send);
  form.append(nameRow, opts);

  const foot = el("div", "chat-foot");
  const adminBtn = el("button", "linkbtn"); adminBtn.type = "button";
  foot.append(adminBtn);
  panel.append(head, pinned, list, status, form, foot);
  document.body.append(fab, panel);

  /* ---------- 상태 ---------- */
  let messages = [], timer = 0, busy = false;
  const isOpen = () => !panel.hidden;
  const adminKey = () => store.get(K.admin, "");

  function syncAdmin() {
    const on = !!adminKey();
    kindSel.querySelector('[value="notice"]').hidden = !on;
    if (!on && kindSel.value === "notice") kindSel.value = "msg";
    adminBtn.textContent = on ? "강사 모드 끄기" : "강사 로그인";
    panel.classList.toggle("is-admin", on);
  }
  nameIn.value = store.get(K.name, "");

  const fmtTime = (t) => { const d = new Date(t); return isNaN(d) ? "" : String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  // 주소는 링크로, 나머지는 글자 그대로 (HTML로 해석하지 않음)
  function linkify(text) {
    const frag = document.createDocumentFragment();
    String(text).split(/(https?:\/\/[^\s<>"']+)/g).forEach((part, i) => {
      if (i % 2) { const a = el("a", null, part); a.href = part; a.target = "_blank"; a.rel = "noopener noreferrer"; frag.append(a); }
      else if (part) frag.append(document.createTextNode(part));
    });
    return frag;
  }
  function bubble(m) {
    const item = el("div", "chat-msg " + m.kind + (m.admin ? " admin" : "") + (m.pending ? " pending" : ""));
    const meta = el("div", "chat-meta");
    meta.append(el("b", null, m.name));
    if (m.admin) { const tag = el("span", "chat-tag", "🧑‍🏫"); tag.title = "강사"; tag.setAttribute("aria-label", "강사"); meta.append(tag); }
    meta.append(el("time", null, m.pending ? "보내는 중…" : fmtTime(m.t)));
    if (adminKey() && !m.pending) {
      const del = el("button", "chat-del", "지우기"); del.type = "button";
      del.addEventListener("click", () => remove(m.id));
      meta.append(del);
    }
    item.append(meta);
    if (m.kind === "code") {
      // 강의자료의 복사 버튼과 같은 모양·동작 (.cmd > pre + .copy)
      const box = el("div", "cmd"); box.append(el("pre", null, m.text));
      const b = el("button", "copy", "복사"); b.type = "button"; box.append(b);
      item.append(box);
    } else {
      const p = el("p"); p.append(linkify(m.text)); item.append(p);
    }
    return item;
  }
  function render() {
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    const notices = messages.filter(m => m.kind === "notice");
    pinned.textContent = "";
    pinned.hidden = !notices.length;
    if (notices.length) {
      const n = notices[notices.length - 1];
      const b = bubble(n); b.classList.add("is-pinned"); pinned.append(b);
    }
    list.textContent = "";
    if (!messages.length) list.append(el("p", "chat-empty", "아직 메시지가 없습니다. 첫 인사를 남겨 보세요."));
    const top = notices[notices.length - 1];
    messages.forEach(m => { if (m !== top) list.append(bubble(m)); });
    if (nearBottom || list.dataset.first !== "done") { list.scrollTop = list.scrollHeight; list.dataset.first = "done"; }
    updateBadge();
  }
  function updateBadge() {
    const last = messages.filter(m => !m.pending).reduce((a, m) => Math.max(a, m.id), 0);
    if (isOpen()) store.set(K.seen, last);
    const unread = messages.filter(m => !m.pending && m.id > store.get(K.seen, 0)).length;
    badge.hidden = !unread; badge.textContent = unread > 9 ? "9+" : String(unread);
  }
  const setStatus = (t, bad) => { status.textContent = t || ""; status.classList.toggle("bad", !!bad); };

  /* ---------- 서버 ---------- */
  async function post(body) {
    const res = await fetch(SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ room: ROOM }, body)) });
    return res.json();
  }
  async function load() {
    if (busy) return;
    try {
      const res = await fetch(SCRIPT_URL + "?chat=" + encodeURIComponent(ROOM), { cache: "no-store" });
      const data = await res.json();
      if (data.ok && Array.isArray(data.messages)) { messages = data.messages; render(); setStatus(""); }
      else if (isOpen()) setStatus("채팅 서버를 준비하는 중입니다. (Apps Script 새 버전 배포 필요)", true);
    } catch { if (isOpen()) setStatus("연결이 잠시 끊겼습니다. 자동으로 다시 시도합니다.", true); }
  }
  function schedule() {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = setTimeout(async () => { await load(); schedule(); }, isOpen() ? OPEN_MS : CLOSED_MS);
  }
  async function remove(id) {
    busy = true;
    try {
      const data = await post({ action: "chat_delete", id, adminKey: adminKey() });
      if (data.ok) messages = data.messages; else setStatus("지우지 못했습니다. 강사 키를 확인하세요.", true);
    } catch { setStatus("지우지 못했습니다. 잠시 후 다시 시도하세요.", true); }
    busy = false; render();
  }

  /* ---------- 동작 ---------- */
  function toggle(open) {
    panel.hidden = !open; fab.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("chat-open", open);
    if (open) { load(); setTimeout(() => (nameIn.value ? ta : nameIn).focus(), 50); updateBadge(); }
    schedule();
  }
  fab.addEventListener("click", () => toggle(panel.hidden));
  close.addEventListener("click", () => toggle(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) toggle(false); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); schedule(); });

  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 2, 130) + "px"; };
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameIn.value.trim(), text = ta.value.trim(), kind = kindSel.value;
    if (!name) { setStatus("이름을 먼저 적어 주세요.", true); nameIn.focus(); return; }
    if (!text || busy) return;
    store.set(K.name, name);
    busy = true; send.disabled = true;
    const temp = { id: Infinity, kind, name, text, t: Date.now(), admin: !!adminKey(), pending: true };
    messages = messages.concat([temp]); ta.value = ""; grow(); render(); list.scrollTop = list.scrollHeight;
    try {
      const data = await post({ action: "chat", name, text, kind, adminKey: adminKey() });
      if (data.ok) { messages = data.messages; setStatus(""); if (kind !== "msg") kindSel.value = "msg"; }
      else {
        messages = messages.filter(m => m !== temp); ta.value = text;
        setStatus(data.error === "too_fast" ? "조금 천천히 보내 주세요." : data.error === "bad_key" ? "공지는 강사 모드에서만 올릴 수 있습니다." : "보내지 못했습니다. 다시 시도해 주세요.", true);
      }
    } catch { messages = messages.filter(m => m !== temp); ta.value = text; setStatus("보내지 못했습니다. 인터넷 연결을 확인해 주세요.", true); }
    busy = false; send.disabled = false; render(); ta.focus();
  });

  // 강사 키는 이 브라우저에만 저장됩니다
  const adminBox = el("form", "chat-adminbox"); adminBox.hidden = true;
  const keyIn = el("input"); keyIn.type = "password"; keyIn.placeholder = "강사 키"; keyIn.setAttribute("aria-label", "강사 키"); keyIn.autocomplete = "off";
  const keyOk = el("button", "btn", "확인"); keyOk.type = "submit";
  adminBox.append(keyIn, keyOk); foot.append(adminBox);
  adminBtn.addEventListener("click", () => {
    if (adminKey()) { store.del(K.admin); syncAdmin(); render(); setStatus("강사 모드를 껐습니다."); return; }
    adminBox.hidden = !adminBox.hidden; if (!adminBox.hidden) keyIn.focus();
  });
  adminBox.addEventListener("submit", async (e) => {
    e.preventDefault();
    const k = keyIn.value.trim(); if (!k) return;
    try {
      const data = await post({ action: "chat_admin", adminKey: k });
      if (data.ok) { store.set(K.admin, k); adminBox.hidden = true; keyIn.value = ""; syncAdmin(); render(); setStatus("강사 모드입니다. 공지 올리기와 지우기를 할 수 있습니다."); }
      else setStatus("강사 키가 맞지 않습니다.", true);
    } catch { setStatus("확인하지 못했습니다. 잠시 후 다시 시도하세요.", true); }
  });

  syncAdmin();
  load(); schedule();
})();
