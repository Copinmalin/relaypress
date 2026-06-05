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
    <p><a href="/admin/sources">Sources éditoriales</a> · <a href="/admin/publishers">Comptes publishers</a></p>

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

const sourcesHtml = String.raw`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RelayPress Sources</title>
  <link rel="stylesheet" href="/assets/admin.css" />
</head>
<body>
  <main>
    <h1>RelayPress Sources</h1>
    <div class="subtitle">Sources récupérées par le Signal Engine. Aucune IA, campagne ou publication depuis cette page.</div>
    <p><a href="/admin">← Retour aux jobs</a> · <a href="/admin/publishers">Comptes publishers</a></p>

    <section class="panel">
      <div class="controls">
        <input id="token" type="password" placeholder="ADMIN_API_TOKEN" autocomplete="off" />
        <select id="provider">
          <option value="">Tous providers</option>
          <option value="btcbreakdown">BTC Breakdown</option>
        </select>
        <select id="status">
          <option value="">Tous statuts</option>
          <option value="new">New</option>
          <option value="ignored">Ignored</option>
          <option value="archived">Archived</option>
        </select>
        <select id="order">
          <option value="desc">Plus récent en haut</option>
          <option value="asc">Plus récent en bas</option>
        </select>
        <button class="primary" id="refresh">Rafraîchir</button>
      </div>
      <div class="status" id="statusLine">Initialisation…</div>
      <div class="hint" id="tokenHint"></div>
    </section>

    <section class="jobs" id="sources"></section>
  </main>
  <script>
    var tokenInput = document.querySelector('#token');
    var providerInput = document.querySelector('#provider');
    var statusInput = document.querySelector('#status');
    var orderInput = document.querySelector('#order');
    var refreshButton = document.querySelector('#refresh');
    var cards = document.querySelector('#sources');
    var statusLine = document.querySelector('#statusLine');
    var tokenHint = document.querySelector('#tokenHint');

    tokenInput.value = localStorage.getItem('relaypress.adminToken') || '';
    providerInput.value = localStorage.getItem('relaypress.sourceProvider') || '';
    statusInput.value = localStorage.getItem('relaypress.sourceStatus') || '';
    orderInput.value = localStorage.getItem('relaypress.sourceOrder') || 'desc';

    function esc(value) { return String(value == null ? '' : value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
    function date(value) { return value ? new Date(value).toLocaleString('fr-FR') : '—'; }
    function hasToken() { return tokenInput.value.trim().length > 0; }
    function updateTokenHint() { tokenHint.textContent = hasToken() ? 'Token admin présent.' : 'Token admin absent.'; }
    function sourceUrl(id, suffix) { return '/editorial-sources/' + encodeURIComponent(id) + suffix; }

    async function api(path, options) {
      options = options || {};
      var token = tokenInput.value.trim();
      if (!token) throw new Error('ADMIN_API_TOKEN manquant');
      var response = await fetch(path, { method: options.method || 'GET', headers: { Authorization: 'Bearer ' + token } });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.message || payload.error || ('HTTP ' + response.status));
      return payload;
    }

    function saveFilters() {
      localStorage.setItem('relaypress.sourceProvider', providerInput.value);
      localStorage.setItem('relaypress.sourceStatus', statusInput.value);
      localStorage.setItem('relaypress.sourceOrder', orderInput.value);
    }

    function buildQuery() {
      var params = new URLSearchParams();
      params.set('limit', '100');
      params.set('order', orderInput.value);
      if (providerInput.value) params.set('provider', providerInput.value);
      if (statusInput.value) params.set('status', statusInput.value);
      return params;
    }

    async function setStatus(id, suffix) {
      await api(sourceUrl(id, suffix), { method: 'POST' });
      await loadSources();
    }

    function row(label, value) { return '<div class="meta"><strong>' + esc(label) + ':</strong> ' + value + '</div>'; }

    function sourceCard(source) {
      var html = '';
      html += '<article class="job">';
      html += '<div class="job-header"><div class="badges"><span class="badge">' + esc(source.provider) + '</span><span class="badge ' + esc(source.status) + '">' + esc(source.status) + '</span></div><div class="meta">Récupéré: ' + date(source.fetchedAt) + '<br/>Mis à jour: ' + date(source.updatedAt) + '</div></div>';
      html += '<h2>' + esc(source.title || 'Sans titre') + '</h2>';
      html += row('URL', '<a href="' + esc(source.sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(source.sourceUrl) + '</a>');
      html += row('Publié source', esc(date(source.publishedAt)));
      html += '<div class="content">' + esc(source.excerpt || '—') + '</div>';
      html += '<div class="actions"><button data-action="reset">Remettre en new</button><button data-action="ignore">Ignorer</button><button data-action="archive">Archiver</button><button data-action="copy">Copier URL</button></div>';
      html += '<details><summary>Métadonnées</summary><pre>' + esc(JSON.stringify(source.metadata, null, 2)) + '</pre></details>';
      html += '</article>';
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      var card = wrap.firstElementChild;
      card.querySelector('[data-action="reset"]').addEventListener('click', function () { setStatus(source.id, '/reset').catch(function (error) { alert(error.message); }); });
      card.querySelector('[data-action="ignore"]').addEventListener('click', function () { setStatus(source.id, '/ignore').catch(function (error) { alert(error.message); }); });
      card.querySelector('[data-action="archive"]').addEventListener('click', function () { setStatus(source.id, '/archive').catch(function (error) { alert(error.message); }); });
      card.querySelector('[data-action="copy"]').addEventListener('click', function () { navigator.clipboard.writeText(source.sourceUrl); statusLine.textContent = 'URL copiée.'; });
      return card;
    }

    async function loadSources() {
      updateTokenHint();
      saveFilters();
      cards.innerHTML = '';
      statusLine.textContent = 'Chargement…';
      try {
        var payload = await api('/editorial-sources?' + buildQuery().toString());
        statusLine.textContent = payload.count + ' source(s).';
        if (!payload.sources.length) {
          cards.innerHTML = '<div class="panel empty">Aucune source pour ces filtres.</div>';
          return;
        }
        payload.sources.forEach(function (source) { cards.appendChild(sourceCard(source)); });
      } catch (error) { statusLine.textContent = 'Erreur: ' + error.message; }
    }

    tokenInput.addEventListener('input', function () { localStorage.setItem('relaypress.adminToken', tokenInput.value.trim()); updateTokenHint(); });
    providerInput.addEventListener('change', loadSources);
    statusInput.addEventListener('change', loadSources);
    orderInput.addEventListener('change', loadSources);
    refreshButton.addEventListener('click', loadSources);
    updateTokenHint();
    loadSources();
  </script>
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
    <p><a href="/admin">← Retour aux jobs</a> · <a href="/admin/sources">Sources éditoriales</a></p>

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
      <div class="bulk">
        <button class="primary" id="connectLinkedIn">Connecter / renouveler LinkedIn</button>
        <span class="hint">Redirection OAuth sécurisée, stockage chiffré côté serveur.</span>
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
    var connectLinkedInButton = document.querySelector('#connectLinkedIn');
    var cards = document.querySelector('#cards');
    var statusLine = document.querySelector('#statusLine');
    var tokenHint = document.querySelector('#tokenHint');

    tokenInput.value = localStorage.getItem('relaypress.adminToken') || '';
    providerInput.value = localStorage.getItem('relaypress.publisherProvider') || '';

    function esc(value) { return String(value == null ? '' : value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
    function date(value) { return value ? new Date(value).toLocaleString('fr-FR') : '—'; }
    function hasToken() { return tokenInput.value.trim().length > 0; }
    function updateTokenHint() {
      var params = new URLSearchParams(window.location.search);
      var oauth = params.get('linkedin_oauth');
      var message = params.get('message');
      var oauthMessage = '';
      if (oauth === 'success') oauthMessage = ' Connexion LinkedIn terminée.';
      if (oauth === 'error') oauthMessage = ' Erreur OAuth LinkedIn: ' + (message || 'échec inconnu');
      tokenHint.textContent = (hasToken() ? 'Token admin présent.' : 'Token admin absent.') + oauthMessage;
    }
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

    async function startLinkedInOAuth() {
      statusLine.textContent = 'Préparation de la redirection LinkedIn…';
      try {
        var payload = await api('/publisher-accounts/linkedin/oauth/start', { method: 'POST' });
        if (!payload.authorizationUrl) throw new Error('URL OAuth LinkedIn absente');
        window.location.href = payload.authorizationUrl;
      } catch (error) {
        statusLine.textContent = 'Erreur: ' + error.message;
      }
    }

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

    async function refreshAccount(id, output) {
      output.textContent = 'Renouvellement en cours…';
      try {
        var payload = await api('/publisher-accounts/' + encodeURIComponent(id) + '/refresh', { method: 'POST' });
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
      html += '<div class="actions"><button class="primary" data-action="check">Tester la connexion</button><button data-action="refresh">Renouveler maintenant</button></div>';
      html += '<details><summary>Résultat du test</summary><pre id="' + resultId + '">Aucun test lancé.</pre></details>';
      html += '</article>';
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      var card = wrap.firstElementChild;
      var output = card.querySelector('#' + CSS.escape(resultId));
      card.querySelector('[data-action="check"]').addEventListener('click', function () { checkConnection(account.id, output); });
      card.querySelector('[data-action="refresh"]').addEventListener('click', function () { refreshAccount(account.id, output); });
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
    connectLinkedInButton.addEventListener('click', startLinkedInOAuth);
    updateTokenHint();
    loadAccounts();
  </script>
</body>
</html>`;

export async function registerAdminPage(app: FastifyInstance): Promise<void> {
  app.get("/admin", async (_request, reply) => {
    return reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(adminHtml);
  });

  app.get("/admin/sources", async (_request, reply) => {
    return reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(sourcesHtml);
  });

  app.get("/admin/publishers", async (_request, reply) => {
    return reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(publishersHtml);
  });
}
