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
    <p><a href="/admin/signals">Signaux</a> · <a href="/admin/sources">Sources récupérées</a> · <a href="/admin/publishers">Comptes publishers</a></p>

    <section class="panel">
      <div class="controls">
        <input id="token" type="password" placeholder="ADMIN_API_TOKEN" autocomplete="off" />
        <select id="view">
          <option value="campaigns">Campagnes à relire</option>
          <option value="todo">Jobs à traiter</option>
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
          <option value="nostr_longform">Nostr long-form</option>
        </select>
        <select id="order">
          <option value="desc">Plus récent en haut</option>
          <option value="asc">Plus récent en bas</option>
        </select>
        <button class="primary" id="refresh">Rafraîchir</button>
      </div>
      <div class="bulk">
        <label><input id="selectAllArchivable" type="checkbox" /> Sélectionner les jobs visibles archivables</label>
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
        <label><input type="checkbox" name="draftPlatform" value="nostr_longform" /> Nostr long-form</label>
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
    <div class="subtitle">Sources éditoriales récupérées. Sélection, ignore ou archive sans créer de publication.</div>
    <p><a href="/admin">← Retour aux jobs</a> · <a href="/admin/signals">Signaux</a> · <a href="/admin/publishers">Comptes publishers</a></p>

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
          <option value="selected">Selected</option>
          <option value="ignored">Ignored</option>
          <option value="archived">Archived</option>
          <option value="failed">Failed</option>
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

    <section class="jobs" id="cards"></section>
  </main>
  <script>
    var tokenInput = document.querySelector('#token');
    var providerInput = document.querySelector('#provider');
    var statusInput = document.querySelector('#status');
    var orderInput = document.querySelector('#order');
    var refreshButton = document.querySelector('#refresh');
    var cards = document.querySelector('#cards');
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
    function saveFilters() {
      localStorage.setItem('relaypress.sourceProvider', providerInput.value);
      localStorage.setItem('relaypress.sourceStatus', statusInput.value);
      localStorage.setItem('relaypress.sourceOrder', orderInput.value);
    }
    async function api(path, options) {
      options = options || {};
      var token = tokenInput.value.trim();
      if (!token) throw new Error('ADMIN_API_TOKEN manquant');
      var response = await fetch(path, { method: options.method || 'GET', headers: { Authorization: 'Bearer ' + token } });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.message || payload.error || ('HTTP ' + response.status));
      return payload;
    }
    function sourceUrl(id, suffix) { return '/source-items/' + encodeURIComponent(id) + suffix; }
    function row(label, value) { return '<div class="meta"><strong>' + esc(label) + ':</strong> ' + value + '</div>'; }
    function buildQuery() {
      var params = new URLSearchParams();
      params.set('limit', '100');
      params.set('order', orderInput.value);
      if (providerInput.value) params.set('provider', providerInput.value);
      if (statusInput.value) params.set('status', statusInput.value);
      return params;
    }
    async function changeStatus(id, status) {
      await api(sourceUrl(id, '/' + status), { method: 'POST' });
      await loadSources();
    }
    function sourceCard(item) {
      var html = '';
      html += '<article class="job">';
      html += '<div class="job-header"><div class="badges"><span class="badge">' + esc(item.provider) + '</span><span class="badge ' + esc(item.status) + '">' + esc(item.status) + '</span><span class="badge">' + esc(item.language || '—') + '</span></div><div class="meta">Récupéré: ' + date(item.fetchedAt) + '<br/>Mis à jour: ' + date(item.updatedAt) + '</div></div>';
      html += '<h2>' + esc(item.title || 'Sans titre') + '</h2>';
      html += row('URL source', '<a href="' + esc(item.sourceUrl) + '" target="_blank" rel="noreferrer">' + esc(item.sourceUrl) + '</a>');
      html += row('URL canonique', '<a href="' + esc(item.canonicalUrl) + '" target="_blank" rel="noreferrer">' + esc(item.canonicalUrl) + '</a>');
      html += '<div class="content">' + esc(item.excerpt || 'Aucun extrait disponible.') + '</div>';
      html += row('ID interne', esc(item.id));
      html += '<div class="actions"><button class="primary" data-action="selected">Sélectionner</button><button data-action="ignored">Ignorer</button><button data-action="archived">Archiver</button><button data-action="copy">Copier URL</button></div>';
      html += '<details><summary>Métadonnées</summary><pre>' + esc(JSON.stringify(item.metadata, null, 2)) + '</pre></details>';
      html += '</article>';
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      var card = wrap.firstElementChild;
      card.querySelector('[data-action="selected"]').addEventListener('click', function () { changeStatus(item.id, 'selected').catch(function (error) { alert(error.message); }); });
      card.querySelector('[data-action="ignored"]').addEventListener('click', function () { changeStatus(item.id, 'ignored').catch(function (error) { alert(error.message); }); });
      card.querySelector('[data-action="archived"]').addEventListener('click', function () { if (confirm('Archiver cette source ?')) changeStatus(item.id, 'archived').catch(function (error) { alert(error.message); }); });
      card.querySelector('[data-action="copy"]').addEventListener('click', function () { navigator.clipboard.writeText(item.canonicalUrl || item.sourceUrl); statusLine.textContent = 'URL copiée.'; });
      return card;
    }
    async function loadSources() {
      updateTokenHint();
      saveFilters();
      cards.innerHTML = '';
      statusLine.textContent = 'Chargement…';
      try {
        var payload = await api('/source-items?' + buildQuery().toString());
        statusLine.textContent = payload.count + ' source(s).';
        if (!payload.items.length) {
          cards.innerHTML = '<div class="panel empty">Aucune source pour ces filtres.</div>';
          return;
        }
        payload.items.forEach(function (item) { cards.appendChild(sourceCard(item)); });
      } catch (error) {
        statusLine.textContent = 'Erreur: ' + error.message;
      }
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
    <p><a href="/admin">← Retour aux jobs</a> · <a href="/admin/sources">Sources récupérées</a></p>

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

    function esc(value) { return String(value == null ? '' : value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
    function date(value) { return value ? new Date(value).toLocaleString('fr-FR') : '—'; }
    function updateTokenHint() { tokenHint.textContent = tokenInput.value.trim() ? 'Token admin présent.' : 'Token admin absent.'; }
    async function api(path, options) { options = options || {}; var token = tokenInput.value.trim(); if (!token) throw new Error('ADMIN_API_TOKEN manquant'); var headers = { Authorization: 'Bearer ' + token }; if (options.body) headers['Content-Type'] = 'application/json'; var response = await fetch(path, { method: options.method || 'GET', headers: headers, body: options.body ? JSON.stringify(options.body) : undefined }); var payload = await response.json().catch(function () { return {}; }); if (!response.ok) throw new Error(payload.message || payload.error || ('HTTP ' + response.status)); return payload; }
    function row(label, value) { return '<div class="meta"><strong>' + esc(label) + ':</strong> ' + value + '</div>'; }
    function accountCard(account) { var html = ''; html += '<article class="job">'; html += '<div class="job-header"><div class="badges"><span class="badge">' + esc(account.provider) + '</span><span class="badge ' + esc(account.status) + '">' + esc(account.status) + '</span></div><div class="meta">Créé: ' + date(account.createdAt) + '<br/>Mis à jour: ' + date(account.updatedAt) + '</div></div>'; html += '<h2>' + esc(account.displayName || account.accountUrn) + '</h2>'; html += row('Compte', esc(account.accountUrn)); html += row('Scopes', esc((account.scopes || []).join(', ') || '—')); html += row('Dernière validation', esc(date(account.lastValidatedAt))); html += row('Expiration token', esc(date(account.tokenExpiresAt))); html += '</article>'; var wrap = document.createElement('div'); wrap.innerHTML = html; return wrap.firstElementChild; }
    async function loadAccounts() { updateTokenHint(); cards.innerHTML = ''; statusLine.textContent = 'Chargement…'; try { var params = new URLSearchParams(); if (providerInput.value) params.set('provider', providerInput.value); var payload = await api('/publisher-accounts?' + params.toString()); statusLine.textContent = payload.count + ' compte(s).'; if (!payload.accounts.length) { cards.innerHTML = '<div class="panel empty">Aucun compte publisher.</div>'; return; } payload.accounts.forEach(function (account) { cards.appendChild(accountCard(account)); }); } catch (error) { statusLine.textContent = 'Erreur: ' + error.message; } }
    async function connectLinkedIn() { try { var payload = await api('/publisher-accounts/linkedin/oauth-url', { method: 'POST' }); window.location.href = payload.authorizationUrl; } catch (error) { alert(error.message); } }
    tokenInput.addEventListener('input', function () { localStorage.setItem('relaypress.adminToken', tokenInput.value.trim()); updateTokenHint(); });
    providerInput.addEventListener('change', loadAccounts);
    refreshButton.addEventListener('click', loadAccounts);
    connectLinkedInButton.addEventListener('click', connectLinkedIn);
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
