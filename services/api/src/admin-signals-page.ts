import type { FastifyInstance } from "fastify";

const signalsHtml = String.raw`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RelayPress Signals</title>
  <link rel="stylesheet" href="/assets/admin.css" />
</head>
<body>
  <main>
    <h1>RelayPress Signals</h1>
    <div class="subtitle">Signaux éditoriaux qualifiés. Tri éditorial uniquement, sans publication.</div>
    <p><a href="/admin">← Retour aux jobs</a> · <a href="/admin/sources">Sources récupérées</a> · <a href="/admin/publishers">Comptes publishers</a></p>

    <section class="panel">
      <div class="controls">
        <input id="token" type="password" placeholder="ADMIN_API_TOKEN" autocomplete="off" />
        <select id="status">
          <option value="">Tous statuts</option>
          <option value="qualified">Qualified</option>
          <option value="needs_sources">Needs sources</option>
          <option value="ready_for_campaign">Ready for campaign</option>
          <option value="ignored">Ignored</option>
          <option value="archived">Archived</option>
        </select>
        <select id="riskLevel">
          <option value="">Tous risques</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input id="category" type="text" placeholder="Catégorie" autocomplete="off" />
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
    var statusInput = document.querySelector('#status');
    var riskInput = document.querySelector('#riskLevel');
    var categoryInput = document.querySelector('#category');
    var orderInput = document.querySelector('#order');
    var refreshButton = document.querySelector('#refresh');
    var cards = document.querySelector('#cards');
    var statusLine = document.querySelector('#statusLine');
    var tokenHint = document.querySelector('#tokenHint');

    tokenInput.value = localStorage.getItem('relaypress.adminToken') || '';
    statusInput.value = localStorage.getItem('relaypress.signalStatus') || '';
    riskInput.value = localStorage.getItem('relaypress.signalRisk') || '';
    categoryInput.value = localStorage.getItem('relaypress.signalCategory') || '';
    orderInput.value = localStorage.getItem('relaypress.signalOrder') || 'desc';

    function esc(value) { return String(value == null ? '' : value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
    function date(value) { return value ? new Date(value).toLocaleString('fr-FR') : '—'; }
    function hasToken() { return tokenInput.value.trim().length > 0; }
    function updateTokenHint() { tokenHint.textContent = hasToken() ? 'Token admin présent.' : 'Token admin absent.'; }
    function saveFilters() {
      localStorage.setItem('relaypress.signalStatus', statusInput.value);
      localStorage.setItem('relaypress.signalRisk', riskInput.value);
      localStorage.setItem('relaypress.signalCategory', categoryInput.value.trim());
      localStorage.setItem('relaypress.signalOrder', orderInput.value);
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
    function buildQuery() {
      var params = new URLSearchParams();
      params.set('limit', '100');
      params.set('order', orderInput.value);
      if (statusInput.value) params.set('status', statusInput.value);
      if (riskInput.value) params.set('riskLevel', riskInput.value);
      if (categoryInput.value.trim()) params.set('category', categoryInput.value.trim());
      return params;
    }
    function row(label, value) { return '<div class="meta"><strong>' + esc(label) + ':</strong> ' + value + '</div>'; }
    function signalUrl(id, suffix) { return '/editorial-signals/' + encodeURIComponent(id) + suffix; }
    async function changeStatus(id, status) {
      await api(signalUrl(id, '/' + status), { method: 'POST' });
      await loadSignals();
    }
    function primarySourcesList(value) {
      var sources = Array.isArray(value) ? value : [];
      if (!sources.length) return '<div class="hint">Aucune source primaire ajoutée.</div>';
      return '<ul>' + sources.map(function (source) { return '<li><a href="' + esc(source) + '" target="_blank" rel="noreferrer">' + esc(source) + '</a></li>'; }).join('') + '</ul>';
    }
    function signalCard(signal) {
      var source = signal.sourceItem || {};
      var html = '';
      html += '<article class="job">';
      html += '<div class="job-header"><div class="badges"><span class="badge">' + esc(signal.category) + '</span><span class="badge ' + esc(signal.status) + '">' + esc(signal.status) + '</span><span class="badge">risk: ' + esc(signal.riskLevel) + '</span></div><div class="meta">Créé: ' + date(signal.createdAt) + '<br/>Mis à jour: ' + date(signal.updatedAt) + '</div></div>';
      html += '<h2>' + esc(source.title || 'Source sans titre') + '</h2>';
      html += row('Résumé interne', esc(signal.summaryInternal));
      html += row('Angle éditorial', esc(signal.editorialAngle));
      html += row('Provider source', esc(source.provider || '—'));
      html += row('Statut source', esc(source.status || '—'));
      html += row('URL canonique', source.canonicalUrl ? '<a href="' + esc(source.canonicalUrl) + '" target="_blank" rel="noreferrer">' + esc(source.canonicalUrl) + '</a>' : '—');
      html += row('Source item ID', esc(signal.sourceItemId));
      html += row('Signal ID', esc(signal.id));
      html += '<details><summary>Sources primaires</summary>' + primarySourcesList(signal.primarySources) + '</details>';
      html += '<details><summary>Métadonnées</summary><pre>' + esc(JSON.stringify(signal.metadata || {}, null, 2)) + '</pre></details>';
      html += '<div class="actions"><button class="primary" data-action="ready_for_campaign">Ready for campaign</button><button data-action="ignored">Ignorer</button><button data-action="archived">Archiver</button></div>';
      html += '</article>';
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      var card = wrap.firstElementChild;
      card.querySelector('[data-action="ready_for_campaign"]').addEventListener('click', function () { changeStatus(signal.id, 'ready_for_campaign').catch(function (error) { alert(error.message); }); });
      card.querySelector('[data-action="ignored"]').addEventListener('click', function () { changeStatus(signal.id, 'ignored').catch(function (error) { alert(error.message); }); });
      card.querySelector('[data-action="archived"]').addEventListener('click', function () { if (confirm('Archiver ce signal ?')) changeStatus(signal.id, 'archived').catch(function (error) { alert(error.message); }); });
      return card;
    }
    async function loadSignals() {
      updateTokenHint();
      saveFilters();
      cards.innerHTML = '';
      statusLine.textContent = 'Chargement…';
      try {
        var payload = await api('/editorial-signals?' + buildQuery().toString());
        statusLine.textContent = payload.count + ' signal(aux).';
        if (!payload.signals.length) {
          cards.innerHTML = '<div class="panel empty">Aucun signal pour ces filtres.</div>';
          return;
        }
        payload.signals.forEach(function (signal) { cards.appendChild(signalCard(signal)); });
      } catch (error) {
        statusLine.textContent = 'Erreur: ' + error.message;
      }
    }

    tokenInput.addEventListener('input', function () { localStorage.setItem('relaypress.adminToken', tokenInput.value.trim()); updateTokenHint(); });
    statusInput.addEventListener('change', loadSignals);
    riskInput.addEventListener('change', loadSignals);
    categoryInput.addEventListener('change', loadSignals);
    orderInput.addEventListener('change', loadSignals);
    refreshButton.addEventListener('click', loadSignals);
    updateTokenHint();
    loadSignals();
  </script>
</body>
</html>`;

export async function registerAdminSignalsPage(app: FastifyInstance): Promise<void> {
  app.get("/admin/signals", async (_request, reply) => {
    return reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(signalsHtml);
  });
}
