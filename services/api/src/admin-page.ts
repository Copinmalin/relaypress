import type { FastifyInstance } from "fastify";

const adminHtml = String.raw`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RelayPress Admin</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #030712; color: #f9fafb; }
    body { margin: 0; padding: 24px; background: radial-gradient(circle at top left, #1f2937, #030712 55%); }
    main { max-width: 1180px; margin: 0 auto; }
    h1, h2 { margin: 0; letter-spacing: -0.04em; }
    h1 { font-size: 32px; }
    h2 { font-size: 20px; margin-bottom: 8px; }
    .subtitle, .status-line, .meta, .hint { color: #9ca3af; }
    .panel, .job { background: rgba(17, 24, 39, 0.86); border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 18px; box-shadow: 0 18px 45px rgba(0,0,0,0.28); }
    .panel { padding: 16px; margin: 18px 0; }
    .controls { display: grid; grid-template-columns: 1fr auto auto auto auto auto; gap: 10px; align-items: center; }
    input, select, button, textarea { border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.32); background: rgba(3, 7, 18, 0.82); color: #f9fafb; padding: 10px 12px; font: inherit; }
    input[type="password"] { width: 100%; box-sizing: border-box; }
    input[type="checkbox"] { accent-color: #f97316; }
    textarea { width: 100%; min-height: 120px; box-sizing: border-box; resize: vertical; line-height: 1.45; margin-top: 12px; }
    button { cursor: pointer; }
    button:hover { border-color: #f97316; }
    button.primary { background: #f97316; color: #111827; border-color: #f97316; font-weight: 700; }
    button.danger:hover { border-color: #ef4444; }
    button[disabled] { cursor: not-allowed; opacity: 0.45; }
    .status-line { margin-top: 12px; font-size: 14px; }
    .hint { margin-top: 8px; font-size: 13px; }
    .bulk-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(148, 163, 184, 0.16); }
    .bulk-actions label, .select-job { display: inline-flex; gap: 7px; align-items: center; color: #e5e7eb; }
    .select-job { font-size: 12px; border: 1px dashed rgba(148, 163, 184, 0.35); border-radius: 999px; padding: 3px 8px; }
    .platforms { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; }
    .platforms label { display: inline-flex; gap: 6px; align-items: center; color: #e5e7eb; }
    .jobs { display: grid; gap: 14px; }
    .job { padding: 16px; }
    .job-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
    .badges, .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .badge { display: inline-flex; border-radius: 999px; padding: 4px 9px; font-size: 12px; border: 1px solid rgba(148, 163, 184, 0.3); color: #e5e7eb; background: rgba(31, 41, 55, 0.72); }
    .pending, .pending_review { border-color: #facc15; color: #fde68a; }
    .approved, .publishing { border-color: #38bdf8; color: #bae6fd; }
    .published { border-color: #22c55e; color: #bbf7d0; }
    .rejected, .failed { border-color: #ef4444; color: #fecaca; }
    .archived { border-color: #94a3b8; color: #cbd5e1; }
    .content { white-space: pre-wrap; line-height: 1.45; padding: 14px; background: rgba(3, 7, 18, 0.62); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 14px; margin: 12px 0; }
    .meta { font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
    .actions { margin-top: 12px; }
    details { margin-top: 12px; }
    summary { cursor: pointer; color: #fdba74; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: rgba(3, 7, 18, 0.72); border-radius: 12px; padding: 12px; border: 1px solid rgba(148, 163, 184, 0.16); }
    .empty { text-align: center; color: #9ca3af; padding: 42px 16px; }
    @media (max-width: 980px) { body { padding: 14px; } .controls { grid-template-columns: 1fr; } .job-header { display: block; } .actions button { width: 100%; } .bulk-actions button { width: 100%; } }
  </style>
</head>
<body>
  <main>
    <h1>RelayPress Admin</h1>
    <div class="subtitle">Créer, valider, éditer, archiver et auditer les jobs de publication.</div>

    <section class="panel">
      <div class="controls">
        <input id="token" type="password" placeholder="ADMIN_API_TOKEN" autocomplete="off" />
        <select id="view">
          <option value="todo" selected>À traiter</option>
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
      <div class="bulk-actions">
        <label><input id="selectAllArchivable" type="checkbox" /> Sélectionner les jobs terminés visibles</label>
        <button id="archiveSelected">Archiver la sélection</button>
        <span class="hint" id="selectionStatus">0 job sélectionné.</span>
      </div>
      <div class="status-line" id="statusLine">Initialisation…</div>
      <div class="hint" id="tokenHint"></div>
    </section>

    <section class="panel">
      <h2>Nouveau brouillon manuel</h2>
      <div class="hint">Crée un job pending_review par plateforme, sans event Nostr source.</div>
      <textarea id="draftContent" placeholder="Texte du brouillon à préparer pour publication…"></textarea>
      <div class="platforms">
        <label><input type="checkbox" name="draftPlatform" value="x" checked /> X</label>
        <label><input type="checkbox" name="draftPlatform" value="linkedin" checked /> LinkedIn</label>
        <label><input type="checkbox" name="draftPlatform" value="facebook" /> Facebook</label>
        <label><input type="checkbox" name="draftPlatform" value="instagram" /> Instagram</label>
      </div>
      <button class="primary" id="createDraft">Créer le brouillon</button>
      <div class="status-line" id="draftStatus"></div>
    </section>

    <section class="jobs" id="jobs"></section>
  </main>

  <script>
    var tokenInput = document.querySelector('#token');
    var viewInput = document.querySelector('#view');
    var statusInput = document.querySelector('#status');
    var platformInput = document.querySelector('#platform');
    var orderInput = document.querySelector('#order');
    var refreshButton = document.querySelector('#refresh');
    var createDraftButton = document.querySelector('#createDraft');
    var archiveSelectedButton = document.querySelector('#archiveSelected');
    var selectAllArchivable = document.querySelector('#selectAllArchivable');
    var selectionStatus = document.querySelector('#selectionStatus');
    var draftContent = document.querySelector('#draftContent');
    var draftStatus = document.querySelector('#draftStatus');
    var jobsEl = document.querySelector('#jobs');
    var statusLine = document.querySelector('#statusLine');
    var tokenHint = document.querySelector('#tokenHint');

    tokenInput.value = localStorage.getItem('relaypress.adminToken') || '';
    viewInput.value = localStorage.getItem('relaypress.view') || 'todo';
    statusInput.value = localStorage.getItem('relaypress.status') || '';
    platformInput.value = localStorage.getItem('relaypress.platform') || '';
    orderInput.value = localStorage.getItem('relaypress.order') || 'desc';

    function hasAdminToken() { return tokenInput.value.trim().length > 0; }

    function updateTokenHint() {
      tokenHint.textContent = hasAdminToken()
        ? 'Token présent : les actions éditoriales peuvent être envoyées.'
        : 'Token absent : aucune donnée éditoriale ne sera affichée.';
    }

    function updateStatusAvailability() {
      statusInput.disabled = viewInput.value !== 'custom';
      if (viewInput.value !== 'custom') statusInput.value = '';
    }

    function selectedJobIds() {
      return Array.from(document.querySelectorAll('input[name="jobSelect"]:checked')).map(function (input) { return input.value; });
    }

    function archivableInputs() {
      return Array.from(document.querySelectorAll('input[name="jobSelect"]'));
    }

    function updateSelectionStatus() {
      var selected = selectedJobIds().length;
      var total = archivableInputs().length;
      selectionStatus.textContent = selected + ' / ' + total + ' job(s) terminé(s) sélectionné(s).';
      archiveSelectedButton.disabled = selected === 0;
      selectAllArchivable.checked = total > 0 && selected === total;
      selectAllArchivable.indeterminate = selected > 0 && selected < total;
    }

    tokenInput.addEventListener('input', function () {
      localStorage.setItem('relaypress.adminToken', tokenInput.value.trim());
      updateTokenHint();
    });

    function jobUrl(id, suffix) { return '/publication-jobs/' + encodeURIComponent(id) + (suffix || ''); }

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function formatDate(value) {
      if (!value) return '—';
      return new Date(value).toLocaleString('fr-FR');
    }

    function selectedDraftPlatforms() {
      return Array.from(document.querySelectorAll('input[name="draftPlatform"]:checked')).map(function (input) { return input.value; });
    }

    function canApprove(job) { return ['pending', 'pending_review'].includes(job.status); }
    function canReject(job) { return ['pending', 'pending_review', 'approved'].includes(job.status); }
    function canEdit(job) { return ['pending', 'pending_review', 'rejected', 'failed'].includes(job.status); }
    function canArchive(job) { return ['published', 'rejected', 'failed'].includes(job.status); }

    function actionHint(job) {
      if (job.status === 'archived') return 'Archivé : conservé pour audit, masqué des vues actives.';
      if (job.status === 'published') return 'Publié : tu peux l’archiver pour nettoyer la vue.';
      if (job.status === 'publishing') return 'Publication en cours côté worker.';
      if (job.status === 'approved') return 'Approuvé : le worker va le publier au prochain tick. Édition verrouillée.';
      if (job.status === 'rejected') return 'Rejeté : tu peux modifier le texte pour le remettre en pending_review, ou l’archiver.';
      if (job.status === 'failed') return 'Échec : tu peux modifier le texte pour le remettre en pending_review, ou l’archiver.';
      if (!hasAdminToken()) return 'Ajoute le token admin pour éditer, approuver, rejeter ou archiver.';
      return 'Édition et validation disponibles.';
    }

    async function api(path, options) {
      options = options || {};
      var headers = new Headers(options.headers || {});
      var token = tokenInput.value.trim();
      if (!token) throw new Error('ADMIN_API_TOKEN manquant dans l’interface');
      headers.set('Authorization', 'Bearer ' + token);
      if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      var response = await fetch(path, Object.assign({}, options, { headers: headers }));
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.message || payload.error || ('HTTP ' + response.status));
      return payload;
    }

    async function createManualDraft() {
      var content = draftContent.value.trim();
      var platforms = selectedDraftPlatforms();
      if (!content) { alert('Le brouillon est vide.'); return; }
      if (!platforms.length) { alert('Sélectionne au moins une plateforme.'); return; }
      draftStatus.textContent = 'Création du brouillon…';
      try {
        var payload = await api('/publication-jobs/manual-draft', { method: 'POST', body: JSON.stringify({ content: content, platforms: platforms }) });
        draftStatus.textContent = payload.count + ' job(s) pending_review créés.';
        draftContent.value = '';
        viewInput.value = 'todo';
        statusInput.value = '';
        await loadJobs();
      } catch (error) { draftStatus.textContent = 'Erreur: ' + error.message; }
    }

    async function updateContent(id, content) { await api(jobUrl(id, '/content'), { method: 'POST', body: JSON.stringify({ content: content }) }); await loadJobs(); }
    async function approveJob(id) { await api(jobUrl(id, '/approve'), { method: 'POST' }); await loadJobs(); }
    async function archiveJob(id) { await api(jobUrl(id, '/archive'), { method: 'POST' }); await loadJobs(); }

    async function archiveSelectedJobs() {
      var ids = selectedJobIds();
      if (!ids.length) return;
      if (!confirm('Archiver ' + ids.length + ' job(s) sélectionné(s) ? Ils resteront disponibles dans la vue Archives.')) return;
      archiveSelectedButton.disabled = true;
      statusLine.textContent = 'Archivage de ' + ids.length + ' job(s)…';
      var archived = 0;
      var failed = 0;
      for (var i = 0; i < ids.length; i += 1) {
        try {
          await api(jobUrl(ids[i], '/archive'), { method: 'POST' });
          archived += 1;
        } catch (_error) {
          failed += 1;
        }
      }
      statusLine.textContent = archived + ' job(s) archivé(s), ' + failed + ' erreur(s).';
      await loadJobs();
    }

    async function rejectJob(id) {
      var reason = prompt('Raison du rejet ?', 'À retravailler avant publication');
      if (reason === null) return;
      await api(jobUrl(id, '/reject'), { method: 'POST', body: JSON.stringify({ reason: reason }) });
      await loadJobs();
    }

    async function loadRuns(id, target) {
      target.textContent = 'Chargement…';
      try {
        var payload = await api(jobUrl(id, '/runs?order=' + encodeURIComponent(orderInput.value)));
        target.textContent = JSON.stringify(payload.runs, null, 2);
      } catch (error) { target.textContent = 'Erreur: ' + error.message; }
    }

    function renderJob(job) {
      var card = document.createElement('article');
      card.className = 'job';
      var runId = 'runs-' + job.id.replace(/[^a-zA-Z0-9]/g, '-');
      var editorId = 'editor-' + job.id.replace(/[^a-zA-Z0-9]/g, '-');
      var sourceLabel = job.sourceEventId || 'manuel';
      var html = '';
      html += '<div class="job-header"><div class="badges">';
      if (canArchive(job)) html += '<label class="select-job"><input type="checkbox" name="jobSelect" value="' + escapeHtml(job.id) + '" /> archiver</label>';
      html += '<span class="badge ' + escapeHtml(job.status) + '">' + escapeHtml(job.status) + '</span>';
      html += '<span class="badge">' + escapeHtml(job.platform) + '</span>';
      html += '<span class="badge">' + escapeHtml(sourceLabel === 'manuel' ? 'manual' : 'nostr') + '</span>';
      html += '</div><div class="meta">Créé: ' + formatDate(job.createdAt) + '<br/>Mis à jour: ' + formatDate(job.updatedAt) + '</div></div>';
      html += '<div class="content">' + escapeHtml(job.adaptedContent || '') + '</div>';
      if (canEdit(job)) html += '<textarea id="' + editorId + '">' + escapeHtml(job.adaptedContent || '') + '</textarea>';
      html += '<div class="meta"><strong>Job:</strong> ' + escapeHtml(job.id) + '<br/><strong>Source:</strong> ' + escapeHtml(sourceLabel) + '<br/><strong>External:</strong> ' + escapeHtml(job.externalPostId || '—') + '<br/><strong>Erreur:</strong> ' + escapeHtml(job.errorMessage || '—') + '</div>';
      html += '<div class="actions">';
      if (canEdit(job)) html += '<button class="primary" data-action="save">Enregistrer le texte</button>';
      if (canApprove(job)) html += '<button class="primary" data-action="approve">Approuver</button>';
      if (canReject(job)) html += '<button class="danger" data-action="reject">Rejeter</button>';
      if (canArchive(job)) html += '<button data-action="archive">Archiver</button>';
      html += '<button data-action="runs">Voir les runs</button><button data-action="copy">Copier ID</button></div>';
      html += '<div class="hint">' + escapeHtml(actionHint(job)) + '</div>';
      html += '<details><summary>Détails source</summary><pre>' + escapeHtml(JSON.stringify(job.sourceEvent, null, 2)) + '</pre></details>';
      html += '<details><summary>Historique d’exécution</summary><pre id="' + runId + '">Clique sur “Voir les runs”.</pre></details>';
      card.innerHTML = html;

      var selectInput = card.querySelector('input[name="jobSelect"]');
      if (selectInput) selectInput.addEventListener('change', updateSelectionStatus);
      var saveButton = card.querySelector('[data-action="save"]');
      if (saveButton) saveButton.addEventListener('click', async function () { try { var editor = card.querySelector('#' + CSS.escape(editorId)); await updateContent(job.id, editor.value); } catch (error) { alert(error.message); } });
      var approveButton = card.querySelector('[data-action="approve"]');
      if (approveButton) approveButton.addEventListener('click', async function () { try { await approveJob(job.id); } catch (error) { alert(error.message); } });
      var rejectButton = card.querySelector('[data-action="reject"]');
      if (rejectButton) rejectButton.addEventListener('click', async function () { try { await rejectJob(job.id); } catch (error) { alert(error.message); } });
      var archiveButton = card.querySelector('[data-action="archive"]');
      if (archiveButton) archiveButton.addEventListener('click', async function () {
        if (!confirm('Archiver ce job ? Il restera disponible dans la vue Archives.')) return;
        try { await archiveJob(job.id); } catch (error) { alert(error.message); }
      });
      var runsButton = card.querySelector('[data-action="runs"]');
      if (runsButton) runsButton.addEventListener('click', async function () { var target = card.querySelector('#' + CSS.escape(runId)); await loadRuns(job.id, target); });
      var copyButton = card.querySelector('[data-action="copy"]');
      if (copyButton) copyButton.addEventListener('click', async function () { await navigator.clipboard.writeText(job.id); statusLine.textContent = 'ID copié dans le presse-papiers.'; });
      return card;
    }

    async function loadJobs() {
      var params = new URLSearchParams();
      params.set('order', orderInput.value);
      params.set('limit', '100');
      if (viewInput.value === 'todo') params.set('view', 'todo');
      if (viewInput.value === 'archived') params.set('view', 'archived');
      if (viewInput.value === 'custom' && statusInput.value) params.set('status', statusInput.value);
      if (platformInput.value) params.set('platform', platformInput.value);
      updateStatusAvailability();
      updateTokenHint();
      localStorage.setItem('relaypress.view', viewInput.value);
      localStorage.setItem('relaypress.status', statusInput.value);
      localStorage.setItem('relaypress.platform', platformInput.value);
      localStorage.setItem('relaypress.order', orderInput.value);
      selectAllArchivable.checked = false;
      selectAllArchivable.indeterminate = false;
      statusLine.textContent = 'Chargement des jobs…';
      jobsEl.innerHTML = '';
      try {
        var payload = await api('/publication-jobs?' + params.toString());
        var label = viewInput.value === 'todo' ? 'vue À traiter' : (viewInput.value === 'archived' ? 'vue Archives' : (viewInput.value === 'all' ? 'vue Tous actifs' : 'statut précis'));
        statusLine.textContent = payload.count + ' job(s), ' + label + ', ordre ' + payload.order + '.';
        if (!payload.jobs.length) {
          jobsEl.innerHTML = '<div class="panel empty">Aucun job pour ces filtres.</div>';
          updateSelectionStatus();
          return;
        }
        for (var i = 0; i < payload.jobs.length; i += 1) jobsEl.appendChild(renderJob(payload.jobs[i]));
        updateSelectionStatus();
      } catch (error) { statusLine.textContent = 'Erreur: ' + error.message; updateSelectionStatus(); }
    }

    createDraftButton.addEventListener('click', createManualDraft);
    archiveSelectedButton.addEventListener('click', archiveSelectedJobs);
    selectAllArchivable.addEventListener('change', function () {
      var checked = selectAllArchivable.checked;
      archivableInputs().forEach(function (input) { input.checked = checked; });
      updateSelectionStatus();
    });
    refreshButton.addEventListener('click', loadJobs);
    viewInput.addEventListener('change', loadJobs);
    statusInput.addEventListener('change', loadJobs);
    platformInput.addEventListener('change', loadJobs);
    orderInput.addEventListener('change', loadJobs);
    updateStatusAvailability();
    updateTokenHint();
    updateSelectionStatus();
    loadJobs();
  </script>
</body>
</html>`;

export async function registerAdminPage(app: FastifyInstance): Promise<void> {
  app.get("/admin", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(adminHtml);
  });
}
