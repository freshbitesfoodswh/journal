/* Ask Jedi Bot — collapsible request panel for all Atrium apps.
   Delivery (no secrets / no paid APIs):
   1) FormSubmit → teri.huff.solutions@gmail.com (subject [Atrium Request]) when service is up
   2) ntfy.sh mirror so Jedi Bot can always poll/read for free
   Optional screenshot: uploaded anonymously to catbox.moe (URL in the request), or attached to ntfy.
*/
(function (global) {
  const FORMSUBMIT = 'https://formsubmit.co/ajax/teri.huff.solutions@gmail.com';
  const NTFY_TOPIC = 'freshbites-atrium-jedi-9c4e2a71';
  const NTFY_URL = 'https://ntfy.sh/' + NTFY_TOPIC;
  const STORE_KEY = 'atrium:jedi-requests';
  const MAX_HISTORY = 40;
  const MAX_SHOT_BYTES = 3.5 * 1024 * 1024; // keep under free upload limits

  function cfg() {
    const c = global.JEDI_REQUEST || {};
    return {
      app: c.app || document.title || 'Atrium app',
      page: c.page || location.href
    };
  }

  function userEmail() {
    try {
      if (global.AtriumAuth && typeof global.AtriumAuth.current === 'function') {
        const u = global.AtriumAuth.current();
        if (u && u.email) return u.email;
      }
      const raw = localStorage.getItem('atrium:user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.email) return u.email;
      }
    } catch (_) {}
    return '';
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
  }
  function saveHistory(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  }

  function chicagoStamp(d) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true, timeZoneName: 'short'
      }).format(d);
    } catch {
      return d.toISOString();
    }
  }

  async function uploadShot(file) {
    if (!file) return '';
    if (file.size > MAX_SHOT_BYTES) throw new Error('Screenshot too large (max ~3.5 MB).');
    const fd = new FormData();
    fd.append('reqtype', 'fileupload');
    fd.append('fileToUpload', file, file.name || 'screenshot.png');
    const r = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: fd });
    const text = (await r.text()).trim();
    if (!r.ok || !/^https?:\/\//i.test(text)) throw new Error('Screenshot upload failed.');
    return text;
  }

  async function sendNtfy(payload, file) {
    const body = [
      'App: ' + payload.app,
      'Page: ' + payload.page,
      'From: ' + (payload.email || '(not signed in)'),
      'When: ' + payload.whenLabel + ' (' + payload.timestamp + ')',
      payload.screenshot ? 'Screenshot: ' + payload.screenshot : 'Screenshot: (none)',
      '',
      payload.message
    ].join('\n');
    const headers = {
      'Title': '[Atrium Request] ' + payload.app,
      'Tags': 'speech_balloon,purple_heart',
      'Priority': 'default'
    };
    if (file) {
      const buf = await file.arrayBuffer();
      headers['Filename'] = file.name || 'screenshot.png';
      const r = await fetch(NTFY_URL, { method: 'PUT', headers, body: buf });
      // Also publish text (file PUT may replace message)
      await fetch(NTFY_URL, { method: 'POST', headers: { 'Title': headers.Title, 'Tags': headers.Tags }, body });
      if (!r.ok) throw new Error('ntfy file upload HTTP ' + r.status);
      return { ok: true, via: 'ntfy' };
    }
    const r = await fetch(NTFY_URL, { method: 'POST', headers, body });
    if (!r.ok) throw new Error('ntfy HTTP ' + r.status);
    return { ok: true, via: 'ntfy' };
  }

  async function sendFormSubmit(payload) {
    const data = {
      _subject: '[Atrium Request] ' + payload.app,
      _template: 'table',
      _captcha: 'false',
      _replyto: payload.email || 'northpolepaper@mail.grokbot.com',
      message: payload.message,
      app: payload.app,
      page: payload.page,
      email: payload.email || '(not signed in)',
      timestamp: payload.timestamp,
      when: payload.whenLabel,
      screenshot: payload.screenshot || '(none)'
    };
    const r = await fetch(FORMSUBMIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    });
    let json = null;
    try { json = await r.json(); } catch (_) {}
    if (r.status === 200 && json && (json.success === 'true' || json.success === true)) {
      return { ok: true, via: 'formsubmit', confirm: false };
    }
    // FormSubmit activation / soft responses
    const msg = (json && (json.message || json.error)) || ('HTTP ' + r.status);
    if (/confirm|activation|check your email/i.test(String(msg))) {
      return { ok: true, via: 'formsubmit', confirm: true, detail: String(msg) };
    }
    throw new Error(String(msg));
  }

  function ensureUi() {
    if (document.getElementById('jedi-root')) return;
    const root = document.createElement('div');
    root.id = 'jedi-root';
    root.innerHTML = `
<style>
#jedi-root{all:initial;font-family:system-ui,-apple-system,sans-serif}
#jedi-tab,#jedi-panel{font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box}
#jedi-tab{position:fixed;right:0;top:42%;z-index:100000;transform:translateY(-50%);
  writing-mode:vertical-rl;text-orientation:mixed;letter-spacing:.04em;
  background:linear-gradient(180deg,#7cf7ff,#a46bff);color:#070a14;border:0;
  border-radius:12px 0 0 12px;padding:14px 8px;font-weight:700;font-size:13px;
  cursor:pointer;box-shadow:-4px 4px 20px rgba(0,0,0,.35)}
#jedi-tab:hover{filter:brightness(1.08)}
#jedi-panel{position:fixed;right:0;top:0;height:100dvh;width:min(360px,100vw);z-index:100001;
  background:rgba(10,8,22,.96);color:#e8f1ff;border-left:1px solid rgba(124,247,255,.28);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  transform:translateX(105%);transition:transform .22s ease;display:flex;flex-direction:column;
  box-shadow:-12px 0 40px rgba(0,0,0,.45)}
#jedi-panel.open{transform:translateX(0)}
#jedi-panel *{box-sizing:border-box}
#jedi-panel header{display:flex;align-items:center;gap:8px;padding:14px 14px 10px;border-bottom:1px solid rgba(255,255,255,.08)}
#jedi-panel header h2{margin:0;font-size:16px;font-weight:600;flex:1;
  background:linear-gradient(90deg,#7cf7ff,#a46bff);-webkit-background-clip:text;color:transparent}
#jedi-panel header button{background:transparent;border:1px solid rgba(124,247,255,.35);color:#e8f1ff;
  border-radius:999px;padding:6px 10px;cursor:pointer}
#jedi-panel .body{padding:12px 14px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:10px}
#jedi-panel label{font-size:12px;opacity:.75;display:block;margin-bottom:4px}
#jedi-panel textarea,#jedi-panel input[type=file]{width:100%;border-radius:12px;border:1px solid rgba(124,247,255,.28);
  background:rgba(0,0,0,.35);color:#e8f1ff;padding:10px;font:inherit}
#jedi-panel textarea{min-height:120px;resize:vertical}
#jedi-panel .meta{font-size:11px;opacity:.65;line-height:1.45;background:rgba(255,255,255,.04);
  border-radius:10px;padding:8px 10px}
#jedi-panel .send{width:100%;border:0;border-radius:12px;padding:12px;font-weight:700;cursor:pointer;
  background:linear-gradient(90deg,#7cf7ff,#a46bff);color:#070a14}
#jedi-panel .send:disabled{opacity:.5;cursor:wait}
#jedi-panel .status{font-size:12px;min-height:1.2em}
#jedi-panel .status.ok{color:#7CFFB2}#jedi-panel .status.err{color:#ff8fab}
#jedi-panel h3{margin:8px 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
#jedi-hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
#jedi-hist li{border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 10px;font-size:12px;background:rgba(0,0,0,.25)}
#jedi-hist .when{opacity:.55;font-size:11px}
#jedi-hist .st{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;font-size:10px;
  border:1px solid rgba(124,247,255,.35);color:#7cf7ff;text-transform:uppercase;letter-spacing:.04em}
#jedi-hist .st.sent{border-color:rgba(124,255,178,.5);color:#7CFFB2}
#jedi-hist .st.confirm{border-color:rgba(255,200,100,.5);color:#ffc864}
#jedi-hist .st.failed{border-color:rgba(255,143,171,.5);color:#ff8fab}
#jedi-shot-preview{max-width:100%;max-height:100px;border-radius:8px;display:none;margin-top:6px}
@media (max-width:640px){
  #jedi-tab{top:auto;bottom:96px;transform:none;writing-mode:horizontal-tb;border-radius:12px 0 0 12px;padding:10px 12px}
}
</style>
<button type="button" id="jedi-tab" aria-expanded="false" title="Ask Jedi Bot">Ask Jedi Bot</button>
<aside id="jedi-panel" aria-hidden="true">
  <header>
    <h2>✦ Ask Jedi Bot</h2>
    <button type="button" id="jedi-close" aria-label="Close">Close</button>
  </header>
  <div class="body">
    <div>
      <label for="jedi-msg">What should change?</label>
      <textarea id="jedi-msg" placeholder="Describe the bug or the change you want…"></textarea>
    </div>
    <div>
      <label for="jedi-shot">Screenshot (optional)</label>
      <input id="jedi-shot" type="file" accept="image/*">
      <img id="jedi-shot-preview" alt="">
    </div>
    <div class="meta" id="jedi-meta"></div>
    <button type="button" class="send" id="jedi-send">Send request</button>
    <div class="status" id="jedi-status"></div>
    <h3>Your requests</h3>
    <ul id="jedi-hist"></ul>
  </div>
</aside>`;
    document.documentElement.appendChild(root);

    const panel = root.querySelector('#jedi-panel');
    const tab = root.querySelector('#jedi-tab');
    const close = root.querySelector('#jedi-close');
    const shot = root.querySelector('#jedi-shot');
    const preview = root.querySelector('#jedi-shot-preview');

    function setOpen(on) {
      panel.classList.toggle('open', on);
      panel.setAttribute('aria-hidden', on ? 'false' : 'true');
      tab.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) refreshMeta();
    }
    tab.onclick = () => setOpen(!panel.classList.contains('open'));
    close.onclick = () => setOpen(false);

    shot.onchange = () => {
      const f = shot.files && shot.files[0];
      if (!f) { preview.style.display = 'none'; preview.removeAttribute('src'); return; }
      const url = URL.createObjectURL(f);
      preview.src = url;
      preview.style.display = 'block';
    };

    root.querySelector('#jedi-send').onclick = onSend;
    renderHistory();
    refreshMeta();
  }

  function refreshMeta() {
    const c = cfg();
    const email = userEmail() || '(sign in to attach your email)';
    const el = document.getElementById('jedi-meta');
    if (el) el.textContent = 'App: ' + c.app + '\nPage: ' + c.page + '\nFrom: ' + email;
  }

  function renderHistory() {
    const ul = document.getElementById('jedi-hist');
    if (!ul) return;
    const list = loadHistory();
    if (!list.length) {
      ul.innerHTML = '<li class="when">No requests yet from this device.</li>';
      return;
    }
    ul.innerHTML = list.map(item => {
      const st = item.status || 'sent';
      const snip = (item.message || '').slice(0, 120).replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]));
      return `<li><div class="when">${item.whenLabel || item.timestamp || ''} <span class="st ${st}">${st}</span></div>
        <div><b>${item.app || ''}</b> — ${snip}${(item.message||'').length>120?'…':''}</div></li>`;
    }).join('');
  }

  async function onSend() {
    const msgEl = document.getElementById('jedi-msg');
    const status = document.getElementById('jedi-status');
    const sendBtn = document.getElementById('jedi-send');
    const shotEl = document.getElementById('jedi-shot');
    const message = (msgEl.value || '').trim();
    if (!message) { status.className = 'status err'; status.textContent = 'Type a request first.'; return; }
    const c = cfg();
    const now = new Date();
    const payload = {
      app: c.app,
      page: c.page,
      email: userEmail(),
      message,
      timestamp: now.toISOString(),
      whenLabel: chicagoStamp(now),
      screenshot: ''
    };
    const file = shotEl.files && shotEl.files[0] ? shotEl.files[0] : null;
    sendBtn.disabled = true;
    status.className = 'status';
    status.textContent = 'Sending…';
    let statusName = 'sent';
    let detail = '';
    try {
      if (file) {
        try { payload.screenshot = await uploadShot(file); }
        catch (upErr) { detail = ' (screenshot link skipped: ' + upErr.message + ')'; }
      }
      const results = await Promise.allSettled([
        sendNtfy(payload, file),
        sendFormSubmit(payload)
      ]);
      const ntfyOk = results[0].status === 'fulfilled';
      const fs = results[1];
      const fsOk = fs.status === 'fulfilled';
      if (!ntfyOk && !fsOk) {
        throw new Error((results[0].reason && results[0].reason.message) || (fs.reason && fs.reason.message) || 'Send failed');
      }
      if (fsOk && fs.value.confirm) statusName = 'confirm';
      else if (ntfyOk || fsOk) statusName = 'sent';
      const bits = [];
      if (ntfyOk) bits.push('queued for Jedi Bot');
      if (fsOk && fs.value.confirm) bits.push('check Teri Gmail for FormSubmit activation link (one-time)');
      else if (fsOk) bits.push('emailed');
      else if (fs.status === 'rejected') bits.push('email deferred (' + (fs.reason && fs.reason.message || 'down') + ')');
      status.className = 'status ok';
      status.textContent = 'Sent — ' + bits.join('; ') + detail;
      msgEl.value = '';
      shotEl.value = '';
      const preview = document.getElementById('jedi-shot-preview');
      if (preview) { preview.style.display = 'none'; preview.removeAttribute('src'); }
    } catch (err) {
      statusName = 'failed';
      status.className = 'status err';
      status.textContent = 'Could not send: ' + (err && err.message ? err.message : err);
    }
    const hist = loadHistory();
    hist.unshift({
      id: 'r_' + Date.now(),
      app: payload.app,
      page: payload.page,
      email: payload.email,
      message: payload.message,
      timestamp: payload.timestamp,
      whenLabel: payload.whenLabel,
      screenshot: payload.screenshot,
      status: statusName
    });
    saveHistory(hist);
    renderHistory();
    sendBtn.disabled = false;
  }

  function mount(opts) {
    if (opts && opts.app) {
      global.JEDI_REQUEST = Object.assign({}, global.JEDI_REQUEST || {}, opts);
    }
    const go = () => ensureUi();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  }

  global.JediRequest = { mount, NTFY_TOPIC, FORMSUBMIT };
  mount();
})(window);
