import type { FastifyInstance } from "fastify";

const pageHtml = String.raw`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RelayPress Source Groups</title>
  <link rel="stylesheet" href="/assets/admin.css" />
</head>
<body>
  <main>
    <h1>RelayPress Source Groups</h1>
    <div class="subtitle">Vue groupee source / signaux / jobs. Lecture seule, sans action metier.</div>
    <p><a href="/admin">Jobs</a> · <a href="/admin/sources">Sources</a> · <a href="/admin/signals">Signals</a></p>

    <section class="panel">
      <div class="controls">
        <input id="token" type="password" placeholder="Admin token" autocomplete="off" />
        <input id="provider" type="text" placeholder="Provider" autocomplete="off" />
        <select id="status">
          <option value="">Tous statuts source</option>
          <option value="new">new</option>
          <option value="selected">selected</option>
          <option value="ignored">ignored</option>
          <option value="archived">archived</option>
          <option value="failed">failed</option>
        </select>
        <select id="order"><option value="desc">Plus recent</option><option value="asc">Plus ancien</option></select>
        <button class="primary" id="refresh">Rafraichir</button>
      </div>
      <div class="status" id="statusLine">Initialisation...</div>
      <div class="hint" id="tokenHint"></div>
    </section>

    <section class="jobs" id="groups"></section>
  </main>
  <script>
    var tokenInput = document.querySelector('#token');
    var providerInput = document.querySelector('#provider');
    var statusInput = document.querySelector('#status');
    var orderInput = document.querySelector('#order');
    var refreshButton = document.querySelector('#refresh');
    var groupsEl = document.querySelector('#groups');
    var statusLine = document.querySelector('#statusLine');
    var tokenHint = document.querySelector('#tokenHint');

    tokenInput.value = localStorage.getItem('relaypress.adminToken') || '';
    providerInput.value = localStorage.getItem('relaypress.groupProvider') || '';
    statusInput.value = localStorage.getItem('relaypress.groupStatus') || '';
    orderInput.value = localStorage.getItem('relaypress.groupOrder') || 'desc';

    function esc(value) { return String(value == null ? '' : value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
    function date(value) { return value ? new Date(value).toLocaleString('fr-FR') : '-'; }
    function updateTokenHint() { tokenHint.textContent = tokenInput.value.trim() ? 'Token admin present.' : 'Token admin absent.'; }
    function saveFilters() { localStorage.setItem('relaypress.groupProvider', providerInput.value.trim()); localStorage.setItem('relaypress.groupStatus', statusInput.value); localStorage.setItem('relaypress.groupOrder', orderInput.value); }
    async function api(path) {
      var token = tokenInput.value.trim();
      if (!token) throw new Error('Token admin manquant');
      var response = await fetch(path, { headers: { Authorization: 'Bearer ' + token } });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.message || payload.error || ('HTTP ' + response.status));
      return payload;
    }
    function buildQuery() {
      var params = new URLSearchParams();
      params.set('limit', '100');
      params.set('order', orderInput.value);
      if (providerInput.value.trim()) params.set('provider', providerInput.value.trim());
      if (statusInput.value) params.set('status', statusInput.value);
      return params;
    }
    function badge(value) { return '<span class="badge ' + esc(value) + '">' + esc(value) + '</span>'; }
    function renderSignal(signal) {
      return '<div class="box"><div class="box-title">Signal ' + badge(signal.status) + '</div><div class="meta">Categorie: ' + esc(signal.category) + ' · Risque: ' + esc(signal.riskLevel) + ' · Cree: ' + date(signal.createdAt) + '</div><div class="content">' + esc(signal.summaryInternal) + '\n\nAngle: ' + esc(signal.editorialAngle) + '</div></div>';
    }
    function renderJob(job) {
      return '<div class="box adapted"><div class="box-title">Job ' + esc(job.platform) + ' ' + badge(job.status) + '</div><div class="meta">Signal: ' + esc(job.editorialSignalId || '-') + ' · Cree: ' + date(job.createdAt) + '</div><div class="content">' + esc(job.adaptedContent || job.sourceContent || '-') + '</div></div>';
    }
    function renderGroup(group) {
      var source = group.sourceItem || {};
      var signals = group.editorialSignals || [];
      var jobs = group.publicationJobs || [];
      var html = '';
      html += '<article class="job">';
      html += '<div class="job-header"><div><h2>' + esc(source.title || 'Source sans titre') + '</h2><div class="badges">' + badge(source.provider || '-') + badge(source.status || '-') + '<span class="badge">' + signals.length + ' signal(s)</span><span class="badge">' + jobs.length + ' job(s)</span></div></div><div class="meta">Fetch: ' + date(source.fetchedAt) + '<br/>ID: ' + esc(source.id) + '</div></div>';
      html += '<div class="meta">URL: ' + (source.canonicalUrl ? '<a href="' + esc(source.canonicalUrl) + '" target="_blank" rel="noreferrer">' + esc(source.canonicalUrl) + '</a>' : '-') + '</div>';
      html += source.excerpt ? '<div class="content">' + esc(source.excerpt) + '</div>' : '';
      html += '<details open><summary>Signaux editoriaux</summary>' + (signals.length ? signals.map(renderSignal).join('') : '<div class="hint">Aucun signal rattache.</div>') + '</details>';
      html += '<details open><summary>Publication jobs</summary>' + (jobs.length ? jobs.map(renderJob).join('') : '<div class="hint">Aucun job rattache.</div>') + '</details>';
      html += '</article>';
      return html;
    }
    async function loadGroups() {
      updateTokenHint();
      saveFilters();
      groupsEl.innerHTML = '';
      statusLine.textContent = 'Chargement...';
      try {
        var payload = await api('/source-groups?' + buildQuery().toString());
        statusLine.textContent = payload.count + ' source(s).';
        groupsEl.innerHTML = payload.groups.length ? payload.groups.map(renderGroup).join('') : '<div class="panel empty">Aucune source pour ces filtres.</div>';
      } catch (error) {
        statusLine.textContent = 'Erreur: ' + error.message;
      }
    }
    tokenInput.addEventListener('input', function () { localStorage.setItem('relaypress.adminToken', tokenInput.value.trim()); updateTokenHint(); });
    providerInput.addEventListener('change', loadGroups);
    statusInput.addEventListener('change', loadGroups);
    orderInput.addEventListener('change', loadGroups);
    refreshButton.addEventListener('click', loadGroups);
    updateTokenHint();
    loadGroups();
  </script>
</body>
</html>`;

export async function registerAdminSourceGroupsPage(app: FastifyInstance): Promise<void> {
  app.get("/admin/source-groups", async (_request, reply) => {
    return reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(pageHtml);
  });
}
