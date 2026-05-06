import type { FastifyInstance } from "fastify";

const adminHtml = String.raw`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RelayPress Admin</title>
  <link rel="stylesheet" href="/assets/admin.css" />
</head>
<body>
  <main>
    <h1>RelayPress Admin</h1>
    <div class="subtitle">Créer, adapter, valider, publier en mock, archiver et auditer les jobs.</div>
    <p><a href="/admin/publishers">Comptes publishers</a></p>

    <section class="panel">
      <div class="controls">
        <input id="token" type="password" placeholder="ADMIN_API_TOKEN" autocomplete="off" />
        <select id="view">
          <option value="todo">À traiter</option>
          <option value="all">Tous actifs</option>
          <option value="archived">Archives</option>
          <option value="custom">Statut précis</option>
        </select>
        <select id="status">
          <option value="">Tous les statuts</option>
          <option value="pending">Pending</option>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="publishing">Publishing</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
          <option value="archived">Archived</option>
        </select>
        <select id="platform">
          <option value="">Toutes plateformes</option>
          <option value="x">X</option>
          <option value="linkedin">LinkedIn</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
        </select>
        <select id="order">
          <option value="desc">Plus récent en haut</option>
          <option value="asc">Plus récent en bas</option>
        </select>
        <button class="primary" id="refresh">Rafraîchir</button>
      </div>
      <div class="bulk">
        <label><input id="selectAllArchivable" type="checkbox" /> Sélectionner les jobs terminés visibles</label>
        <button id="archiveSelected">Archiver la sélection</button>
        <span class="hint" id="selectionStatus">0 job sélectionné.</span>
      </div>
      <div class="status" id="statusLine">Initialisation…</div>
      <div class="hint" id="tokenHint"></div>
    </section>

    <section class="panel">
      <h2>Nouveau brouillon manuel</h2>
      <textarea id="draftContent" placeholder="Texte source à préparer…"></textarea>
      <div class="platforms">
        <label><input type="checkbox" name="draftPlatform" value="x" checked /> X</label>
        <label><input type="checkbox" name="draftPlatform" value="linkedin" checked /> LinkedIn</label>
        <label><input type="checkbox" name="draftPlatform" value="facebook" /> Facebook</label>
        <label><input type="checkbox" name="draftPlatform" value="instagram" /> Instagram</label>
      </div>
      <button class="primary" id="createDraft">Créer le brouillon</button>
      <div class="status" id="draftStatus"></div>
    </section>

    <section class="jobs" id="jobs"></section>
  </main>
  <script src="/assets/admin.js"></script>
</body>
</html>`;

const publishersHtml = String.raw`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RelayPress Publishers</title>
  <link rel="stylesheet" href="/assets/admin.css" />
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
      </div>
      <div class="status" id="statusLine">Initialisation…</div>
      <div class="hint" id="tokenHint"></div>
    </section>

    <section class="jobs" id="cards"></section>
  </main>
  <script>
    var tokenInput = document.querySelector('#token');
    var providerInput = document.querySelector('#provider');
    var refreshButton = document.querySelector('#refresh');
    var cards = document.querySelector('#cards');
    var statusLine = document.querySelector('#statusLine');
    var tokenHint = document.querySelector('#tokenHint');

    tokenInput.value = localStorage.getItem('relaypress.adminToken') || '';
    providerInput.value = localStorage.getItem('relaypress.publisherProvider') || '';

    function esc(value) { return String(value == null ? '' : value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
    function date(value) { return value ? new Date(value).toLocaleString('fr-FR') : '—'; }
    function hasToken() { return tokenInput.value.trim().length > 0; }
    function updateTokenHint() { tokenHint.textContent = hasToken() ? 'Token admin présent.' : 'Token admin absent.'; }
    function yesNo(value) { return value ? '<span class="published">oui</span>' : '<span class="pending">non</span>'; }

    async function api(path, options) {
      options = options || {};
      var token = tokenInput.value.trim();
      if (!token) throw new Error('ADMIN_API_TOKEN manquant');
      var response = await fetch(path, { method: options.method || 'GET', headers: { Authorization: 'Bearer ' + token } });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.message || payload.error || ('HTTP ' + response.status));
      return payload;
    }

    function row(label, value) { return '<div class="meta"><strong>' + esc(label) + ':</strong> ' + value + '</div>'; }

    async function checkConnection(id, output) {
      output.textContent = 'Test en cours…';
      try {
        var payload = await api('/publisher-accounts/' + encodeURIComponent(id) + '/check-connection', { method: 'POST' });
        output.textContent = JSON.stringify(payload.result, null, 2);
        await loadAccounts(false);
      } catch (error) {
        output.textContent = 'Erreur: ' + error.message;
      }
    }

    function accountCard(account) {
      var scopes = Array.isArray(account.scopes) ? account.scopes : [];
      var resultId = 'check-' + String(account.id).replace(/[^a-zA-Z0-9]/g, '-');
      var html = '';
      html += '<article class="job">';
      html += '<div class="badges"><span class="badge">' + esc(account.provider) + '</span><span class="badge ' + esc(account.status) + '">' + esc(account.status) + '</span></div>';
      html += row('Nom', esc(account.displayName || '—'));
      html += row('URN', esc(account.accountUrn));
      html += row('Scopes', scopes.map(function (scope) { return '<span class="badge">' + esc(scope) + '</span>'; }).join(' '));
      html += row('Accès publication', yesNo(account.hasAccessToken));
      html += row('Renouvellement', yesNo(account.hasRefreshToken));
      html += row('Expiration accès', esc(date(account.tokenExpiresAt)));
      html += row('Expiration renouvellement', esc(date(account.refreshTokenExpiresAt)));
      html += row('Dernière validation', esc(date(account.lastValidatedAt)));
      html += row('Mis à jour', esc(date(account.updatedAt)));
      html += row('ID interne', esc(account.id));
      html += '<div class="actions"><button class="primary" data-action="check">Tester la connexion</button></div>';
      html += '<details><summary>Résultat du test</summary><pre id="' + resultId + '">Aucun test lancé.</pre></details>';
      html += '</article>';
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      var card = wrap.firstElementChild;
      var output = card.querySelector('#' + CSS.escape(resultId));
      card.querySelector('[data-action="check"]').addEventListener('click', function () { checkConnection(account.id, output); });
      return card;
    }

    async function loadAccounts(showLoading) {
      if (showLoading !== false) showLoading = true;
      updateTokenHint();
      localStorage.setItem('relaypress.publisherProvider', providerInput.value);
      cards.innerHTML = '';
      if (showLoading) statusLine.textContent = 'Chargement…';
      try {
        var params = new URLSearchParams();
        if (providerInput.value) params.set('provider', providerInput.value);
        var payload = await api('/publisher-accounts' + (params.toString() ? '?' + params.toString() : ''));
        statusLine.textContent = payload.count + ' compte(s).';
        if (!payload.accounts.length) {
          cards.innerHTML = '<div class="panel empty">Aucun compte publisher.</div>';
          return;
        }
        payload.accounts.forEach(function (account) { cards.appendChild(accountCard(account)); });
      } catch (error) {
        statusLine.textContent = 'Erreur: ' + error.message;
      }
    }

    tokenInput.addEventListener('input', function () { localStorage.setItem('relaypress.adminToken', tokenInput.value.trim()); updateTokenHint(); });
    providerInput.addEventListener('change', loadAccounts);
    refreshButton.addEventListener('click', loadAccounts);
    updateTokenHint();
    loadAccounts();
  </script>
</body>
</html>`;

export async function registerAdminPage(app: FastifyInstance): Promise<void> {
  app.get("/admin", async (_request, reply) => {
    return reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(adminHtml);
  });

  app.get("/admin/publishers", async (_request, reply) => {
    return reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(publishersHtml);
  });
}
