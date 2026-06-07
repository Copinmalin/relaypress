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
    <div class="subtitle">Signaux editoriaux qualifies. Tri editorial et preparation explicite de jobs, sans publication automatique.</div>
    <p><a href="/admin">Retour aux jobs</a> · <a href="/admin/sources">Sources recuperees</a> · <a href="/admin/publishers">Comptes publishers</a></p>

    <section class="panel">
      <div class="controls">
        <input id="token" type="password" placeholder="Admin token" autocomplete="off" />
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
        <input id="category" type="text" placeholder="Categorie" autocomplete="off" />
        <select id="order"><option value="desc">Plus recent en haut</option><option value="asc">Plus recent en bas</option></select>
        <button class="primary" id="refresh">Rafraichir</button>
      </div>
      <div class="status" id="statusLine">Initialisation...</div>
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
    function date(value) { return value ? new Date(value).toLocaleString('fr-FR') : '-'; }
    function updateTokenHint() { tokenHint.textContent = tokenInput.value.trim() ? 'Token admin present.' : 'Token admin absent.'; }
    function saveFilters() { localStorage.setItem('relaypress.signalStatus', statusInput.value); localStorage.setItem('relaypress.signalRisk', riskInput.value); localStorage.setItem('relaypress.signalCategory', categoryInput.value.trim()); localStorage.setItem('relaypress.signalOrder', orderInput.value); }
    async function api(path, options) {
      options = options || {};
      var token = tokenInput.value.trim();
      if (!token) throw new Error('Token admin manquant');
      var headers = { Authorization: 'Be' + 'arer ' + token };
      if (options.body) headers['Content-Type'] = 'application/json';
      var response = await fetch(path, { method: options.method || 'GET', headers: headers, body: options.body ? JSON.stringify(options.body) : undefined });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.message || payload.error || ('HTTP ' + response.status));
      return payload;
    }
    function buildQuery() { var params = new URLSearchParams(); params.set('limit', '100'); params.set('order', orderInput.value); if (statusInput.value) params.set('status', statusInput.value); if (riskInput.value) params.set('riskLevel', riskInput.value); if (categoryInput.value.trim()) params.set('category', categoryInput.value.trim()); return params; }
    function row(label, value) { return '<div class="meta"><strong>' + esc(label) + ':</strong> ' + value + '</div>'; }
    function signalUrl(id, suffix) { return '/editorial-signals/' + encodeURIComponent(id) + suffix; }
    async function changeStatus(id, status) { await api(signalUrl(id, '/' + status), { method: 'POST' }); await loadSignals(); }
    async function createJobsFromSignal(id, card) {
      var platforms = Array.from(card.querySelectorAll('[data-platform]:checked')).map(function (input) { return input.value; });
      var status = card.querySelector('[data-job-status]').value;
      if (!platforms.length) throw new Error('Selectionne au moins une plateforme.');
      var payload = await api(signalUrl(id, '/publication-jobs'), { method: 'POST', body: { platforms: platforms, status: status } });
      alert(payload.count + ' job(s) prepare(s).');
      window.location.href = '/admin?view=todo';
    }
    function primarySourcesList(value) { var sources = Array.isArray(value) ? value : []; if (!sources.length) return '<div class="hint">Aucune source primaire ajoutee.</div>'; return '<ul>' + sources.map(function (source) { return '<li><a href="' + esc(source) + '" target="_blank" rel="noreferrer">' + esc(source) + '</a></li>'; }).join('') + '</ul>'; }
    function platformControls(signal) {
      if (signal.status !== 'ready_for_campaign') return '<div class="hint">Passe ce signal en ready_for_campaign pour preparer des jobs.</div>';
      return '<div class="panel"><div class="hint">Preparation explicite des jobs. Aucun job ne sera approuve ni publie automatiquement.</div><div class="controls"><label><input type="checkbox" data-platform value="x" checked /> X</label><label><input type="checkbox" data-platform value="linkedin" checked /> LinkedIn</label><label><input type="checkbox" data-platform value="facebook" /> Facebook</label><label><input type="checkbox" data-platform value="instagram" /> Instagram</label><select data-job-status><option value="pending_review">pending_review</option><option value="drafted">drafted</option></select><button class="primary" data-action="create_jobs">Preparer les jobs</button></div></div>';
    }
    function signalCard(signal) {
      var source = signal.sourceItem || {};
      var html = '';
      html += '<article class="job">';
      html += '<div class="job-header"><div class="badges"><span class="badge">' + esc(signal.category) + '</span><span class="badge ' + esc(signal.status) + '">' + esc(signal.status) + '</span><span class="badge">risk: ' + esc(signal.riskLevel) + '</span></div><div class="meta">Cree: ' + date(signal.createdAt) + '<br/>Mis a jour: ' + date(signal.updatedAt) + '</div></div>';
      html += '<h2>' + esc(source.title || 'Source sans titre') + '</h2>';
      html += row('Resume interne', esc(signal.summaryInternal));
      html += row('Angle editorial', esc(signal.editorialAngle));
      html += row('Provider source', esc(source.provider || '-'));
      html += row('Statut source', esc(source.status || '-'));
      html += row('URL canonique', source.canonicalUrl ? '<a href="' + esc(source.canonicalUrl) + '" target="_blank" rel="noreferrer">' + esc(source.canonicalUrl) + '</a>' : '-');
      html += row('Source item ID', esc(signal.sourceItemId));
      html += row('Signal ID', esc(signal.id));
      html += '<details><summary>Sources primaires</summary>' + primarySourcesList(signal.primarySources) + '</details>';
      html += '<details><summary>Metadonnees</summary><pre>' + esc(JSON.stringify(signal.metadata || {}, null, 2)) + '</pre></details>';
      html += '<div class="actions"><button class="primary" data-action="ready_for_campaign">Ready for campaign</button><button data-action="ignored">Ignorer</button><button data-action="archived">Archiver</button></div>';
      html += platformControls(signal);
      html += '</article>';
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      var card = wrap.firstElementChild;
      card.querySelector('[data-action="ready_for_campaign"]').addEventListener('click', function () { changeStatus(signal.id, 'ready_for_campaign').catch(function (error) { alert(error.message); }); });
      card.querySelector('[data-action="ignored"]').addEventListener('click', function () { changeStatus(signal.id, 'ignored').catch(function (error) { alert(error.message); }); });
      card.querySelector('[data-action="archived"]').addEventListener('click', function () { if (confirm('Archiver ce signal ?')) changeStatus(signal.id, 'archived').catch(function (error) { alert(error.message); }); });
      var button = card.querySelector('[data-action="create_jobs"]');
      if (button) button.addEventListener('click', function () { createJobsFromSignal(signal.id, card).catch(function (error) { alert(error.message); }); });
      return card;
    }
    async function loadSignals() { updateTokenHint(); saveFilters(); cards.innerHTML = ''; statusLine.textContent = 'Chargement...'; try { var payload = await api('/editorial-signals?' + buildQuery().toString()); statusLine.textContent = payload.count + ' signal(aux).'; if (!payload.signals.length) { cards.innerHTML = '<div class="panel empty">Aucun signal pour ces filtres.</div>'; return; } payload.signals.forEach(function (signal) { cards.appendChild(signalCard(signal)); }); } catch (error) { statusLine.textContent = 'Erreur: ' + error.message; } }

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
