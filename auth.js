/* Shared Google Identity Services gate (client-side, free). Depends on auth-config.js */
(function (global) {
  const KEY = 'atrium:user';
  function cfg() { return global.ATRIUM_AUTH || { clientId: '', allowlist: [] }; }
  function allowed(email) {
    const list = (cfg().allowlist || []).map(e => String(e).toLowerCase());
    return list.includes(String(email || '').toLowerCase());
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  }
  function save(u) {
    if (u) localStorage.setItem(KEY, JSON.stringify(u));
    else localStorage.removeItem(KEY);
  }
  function parseJwt(cred) {
    try {
      const p = cred.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(p));
    } catch { return null; }
  }
  function current() { return load(); }
  function signOut() { save(null); location.reload(); }

  function mountGate(opts) {
    const o = opts || {};
    const user = load();
    if (user && allowed(user.email)) {
      if (o.onReady) o.onReady(user);
      return user;
    }
    if (user && !allowed(user.email)) save(null);

    const overlay = document.createElement('div');
    overlay.id = 'auth-gate';
    overlay.innerHTML = `
<style>
#auth-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 20% 0,#1b2a55,transparent 50%),radial-gradient(circle at 90% 100%,#3a1b5e,transparent 50%),#070a14;
  color:#e8f1ff;font-family:system-ui,sans-serif;padding:24px}
#auth-gate .box{max-width:420px;width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(124,247,255,.2);
  border-radius:20px;padding:28px;backdrop-filter:blur(16px);text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}
#auth-gate h1{margin:0 0 8px;font-weight:300;letter-spacing:.2em;text-transform:uppercase;
  background:linear-gradient(90deg,#7cf7ff,#a46bff);-webkit-background-clip:text;color:transparent}
#auth-gate p{opacity:.7;font-size:14px;line-height:1.5}
#auth-gate #gsi{display:flex;justify-content:center;margin:18px 0}
#auth-gate .err{color:#ff8fab;font-size:13px;min-height:1.2em}
#auth-gate .hint{font-size:12px;opacity:.5;margin-top:12px}
#auth-gate .dev{margin-top:16px;border-top:1px solid rgba(255,255,255,.08);padding-top:14px}
#auth-gate input{width:100%;padding:10px;border-radius:10px;border:1px solid rgba(124,247,255,.25);
  background:rgba(0,0,0,.35);color:inherit;margin:8px 0}
#auth-gate button.devbtn{width:100%;padding:10px;border-radius:10px;border:0;cursor:pointer;
  background:linear-gradient(90deg,#7cf7ff,#a46bff);color:#070a14;font-weight:600}
</style>
<div class="box">
  <h1>${o.title || 'The Atrium'}</h1>
  <p>${o.blurb || 'Sign in with Google to continue. Access is limited to invited emails.'}</p>
  <div id="gsi"></div>
  <div class="err" id="auth-err"></div>
  <div class="hint" id="auth-hint"></div>
  <div class="dev" id="auth-dev" style="display:none">
    <small>Dev unlock (client ID not set yet)</small>
    <input id="dev-email" type="email" placeholder="your allowed email">
    <button class="devbtn" id="dev-go">Continue</button>
  </div>
</div>`;
    document.body.appendChild(overlay);
    const err = overlay.querySelector('#auth-err');
    const hint = overlay.querySelector('#auth-hint');
    const clientId = (cfg().clientId || '').trim();

    function admit(u) {
      if (!allowed(u.email)) {
        err.textContent = u.email + ' is not on the allowlist.';
        save(null);
        return;
      }
      save(u);
      overlay.remove();
      if (o.onReady) o.onReady(u);
    }

    if (!clientId) {
      hint.textContent = 'Google Client ID not configured yet — use an allowlisted email below, or paste the Client ID into auth-config.js.';
      overlay.querySelector('#auth-dev').style.display = 'block';
      overlay.querySelector('#dev-go').onclick = () => {
        const email = overlay.querySelector('#dev-email').value.trim();
        admit({ email, name: email.split('@')[0], picture: '', sub: 'dev:' + email, via: 'dev' });
      };
      return null;
    }

    function bootGis() {
      if (!global.google || !google.accounts || !google.accounts.id) {
        err.textContent = 'Google Sign-In script failed to load.';
        return;
      }
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => {
          const payload = parseJwt(resp.credential);
          if (!payload || !payload.email) { err.textContent = 'Could not read Google credential.'; return; }
          admit({
            email: payload.email,
            name: payload.name || payload.email,
            picture: payload.picture || '',
            sub: payload.sub,
            via: 'google'
          });
        },
        auto_select: false,
        cancel_on_tap_outside: false
      });
      google.accounts.id.renderButton(overlay.querySelector('#gsi'), {
        theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', width: 280
      });
    }

    if (global.google && google.accounts) bootGis();
    else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = bootGis;
      s.onerror = () => { err.textContent = 'Could not load Google Identity Services.'; };
      document.head.appendChild(s);
    }
    return null;
  }

  function userBar(el) {
    const u = load();
    if (!u || !el) return;
    el.innerHTML = `<span class="who">${u.picture ? `<img src="${u.picture}" alt="">` : ''}<b>${u.name || u.email}</b></span>
      <button type="button" class="signout">Sign out</button>`;
    el.querySelector('.signout').onclick = signOut;
  }

  global.AtriumAuth = { mountGate, current, signOut, userBar, allowed, KEY };
})(window);
