import type { FastifyInstance } from "fastify";

const publishersHtml = String.raw`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RelayPress Publishers</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #030712; color: #f9fafb; }
    body { margin: 0; padding: 24px; background: radial-gradient(circle at top left, #1f2937, #030712 55%); }
    main { max-width: 1080px; margin: 0 auto; }
    h1 { margin: 0; font-size: 32px; letter-spacing: -0.04em; }
    a { color: #fdba74; }
    .subtitle, .hint, .meta, .status { color: #9ca3af; }
    .panel, .card { background: rgba(17, 24, 39, 0.88); border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 18px; box-shadow: 0 18px 45px rgba(0,0,0,0.28); }
    .panel { padding: 16px; margin: 18px 0; }
    .controls { display: grid; grid-template-columns: 1fr auto auto auto auto; gap: 10px; align-items: center; }
    input, button, select { border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.32); background: rgba(3, 7, 18, 0.82); color: #f9fafb; padding: 10px 12px; font: inherit; }
    button { cursor: pointer; }
    button:hover { border-color: #f97316; }
    button.primary { background: #f97316; color: #111827; border-color: #f97316; font-weight: 700; }
    .cards { display: grid; gap: 14px; }
    .card { padding: 16px; }
    .row { display: grid; grid-template-columns: 170px 1fr; gap: 10px; padding: 7px 0; border-bottom: 1px solid rgba(148, 163, 184, .12); }
    .row:last-child { border-bottom: 0; }
    .label { color: #9ca3af; }
    .badges { display: flex; gap: 8px; flex-wrap: wrap; }
    .badge { display: inline-flex; border-radius: 999px; padding: 4px 9px; font-size: 12px; border: 1px solid rgba(148, 163, 184, .3); background: rgba(31, 41, 55, .72); }
    .connected { border-color: #22c55e; color: #bbf7d0; }
    .invalid, .expired { border-color: #ef4444; color: #fecaca; }
    .warning { color: #fde68a; }
    .ok { color: #bbf7d0; }
    @media (max-width: 960px) { body { padding: 14px; } .controls, .row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>RelayPress Publishers</h1>
    <div class="subtitle">Comptes de publication connectés. Les valeurs sensibles ne sont jamais affichées.</div>
    <p><a href="/admin">← Retour aux jobs</a></p>

    <section class="panel">
      <div class="controls">
        <input id="token" type="password" placeholder="ADMIN_API_TOKEN" autocomplete="off" />
        <select id="provider">
          <option value="">Tous providers</option>
          <option value="linkedin">LinkedIn</option>
          <option value="x">X</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="mastodon">Mastodon</option>
          <option value="wordpress">WordPress</option>
        </select>
        <button class="primary" id="refresh">Rafraîchir</button>
        <button id="connectLinkedin">Connecter LinkedIn</button>
        <button id="connectX">Connecter X</button>
      </div>
      <div class="status" id="statusLine">Initialisation…</div>
      <div class="hint" id="tokenHint"></div>
    </section>

    <section class="cards" id="cards"></section>
  </main>
  <script>
    var tokenInput = document.querySelector('#token');
    var providerInput = document.querySelector('#provider');
    var refreshButton = document.querySelector('#refresh');
    var connectLinkedinButton = document.querySelector('#connectLinkedin');
    var connectXButton = document.querySelector('#connectX');
    var cards = document.querySelector('#cards');
    var statusLine = document.querySelector('#statusLine');
    var tokenHint = document.querySelector('#tokenHint');

    tokenInput.value = localStorage.getItem('relaypress.adminToken') || '';
    providerInput.value = localStorage.getItem('relaypress.publisherProvider') || '';

    function esc(value) { return String(value == null ? '' : value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
    function date(value) { return value ? new Date(value).toLocaleString('fr-FR') : '—'; }
    function hasToken() { return tokenInput.value.trim().length > 0; }
    function updateTokenHint() { tokenHint.textContent = hasToken() ? 'Token admin présent.' : 'Token admin absent.'; }
    function yesNo(value) { return value ? '<span class="ok">oui</span>' : '<span class="warning">non</span>'; }

    async function api(path, options) {
      var token = tokenInput.value.trim();
      var requestOptions = options || {};
      if (!token) throw new Error('ADMIN_API_TOKEN manquant');
      var response = await fetch(path, {
        method: requestOptions.method || 'GET',
        headers: { Authorization: 'Bearer ' + token },
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.message || payload.error || ('HTTP ' + response.status));
      return payload;
    }

    function accountCard(account) {
      var scopes = Array.isArray(account.scopes) ? account.scopes : [];
      var html = '';
      html += '<article class="card">';
      html += '<div class="badges"><span class="badge">' + esc(account.provider) + '</span><span class="badge ' + esc(account.status) + '">' + esc(account.status) + '</span></div>';
      html += '<div class="row"><div class="label">Nom</div><div>' + esc(account.displayName || '—') + '</div></div>';
      html += '<div class="row"><div class="label">URN</div><div>' + esc(account.accountUrn) + '</div></div>';
      html += '<div class="row"><div class="label">Scopes</div><div class="badges">' + scopes.map(function (scope) { return '<span class="badge">' + esc(scope) + '</span>'; }).join('') + '</div></div>';
      html += '<div class="row"><div class="label">Accès publication</div><div>' + yesNo(account.hasAccessToken) + '</div></div>';
      html += '<div class="row"><div class="label">Renouvellement</div><div>' + yesNo(account.hasRefreshToken) + '</div></div>';
      html += '<div class="row"><div class="label">Expiration accès</div><div>' + esc(date(account.tokenExpiresAt)) + '</div></div>';
      html += '<div class="row"><div class="label">Expiration renouvellement</div><div>' + esc(date(account.refreshTokenExpiresAt)) + '</div></div>';
      html += '<div class="row"><div class="label">Dernière validation</div><div>' + esc(date(account.lastValidatedAt)) + '</div></div>';
      html += '<div class="row"><div class="label">Mis à jour</div><div>' + esc(date(account.updatedAt)) + '</div></div>';
      html += '<div class="row"><div class="label">ID interne</div><div class="meta">' + esc(account.id) + '</div></div>';
      html += '</article>';
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      return wrap.firstElementChild;
    }

    async function loadAccounts() {
      updateTokenHint();
      localStorage.setItem('relaypress.publisherProvider', providerInput.value);
      cards.innerHTML = '';
      statusLine.textContent = 'Chargement…';
      try {
        var params = new URLSearchParams();
        if (providerInput.value) params.set('provider', providerInput.value);
        var payload = await api('/publisher-accounts' + (params.toString() ? '?' + params.toString() : ''));
        statusLine.textContent = payload.count + ' compte(s).';
        if (!payload.accounts.length) {
          cards.innerHTML = '<div class="panel">Aucun compte publisher.</div>';
          return;
        }
        payload.accounts.forEach(function (account) { cards.appendChild(accountCard(account)); });
      } catch (error) {
        statusLine.textContent = 'Erreur: ' + error.message;
      }
    }

    async function startOAuth(provider) {
      updateTokenHint();
      statusLine.textContent = 'Démarrage OAuth ' + provider + '…';
      try {
        var payload = await api('/publisher-accounts/' + provider + '/oauth/start', { method: 'POST' });
        if (!payload.authorizationUrl) throw new Error('URL OAuth absente');
        window.location.assign(payload.authorizationUrl);
      } catch (error) {
        statusLine.textContent = 'Erreur OAuth ' + provider + ': ' + error.message;
      }
    }

    tokenInput.addEventListener('input', function () { localStorage.setItem('relaypress.adminToken', tokenInput.value.trim()); updateTokenHint(); });
    providerInput.addEventListener('change', loadAccounts);
    refreshButton.addEventListener('click', loadAccounts);
    connectLinkedinButton.addEventListener('click', function () { startOAuth('linkedin'); });
    connectXButton.addEventListener('click', function () { startOAuth('x'); });
    updateTokenHint();
    loadAccounts();
  </script>
</body>
</html>`;

export async function registerAdminPublishersPage(app: FastifyInstance): Promise<void> {
  app.get("/admin/publishers", async (_request, reply) => {
    return reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(publishersHtml);
  });
}
