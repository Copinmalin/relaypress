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
    h1 { margin: 0; font-size: 32px; letter-spacing: -0.04em; }
    .subtitle, .status-line, .meta { color: #9ca3af; }
    .panel, .job { background: rgba(17, 24, 39, 0.86); border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 18px; box-shadow: 0 18px 45px rgba(0,0,0,0.28); }
    .panel { padding: 16px; margin: 18px 0; }
    .controls { display: grid; grid-template-columns: 1fr repeat(4, auto); gap: 10px; align-items: center; }
    input, select, button { border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.32); background: rgba(3, 7, 18, 0.82); color: #f9fafb; padding: 10px 12px; font: inherit; }
    input[type="password"] { width: 100%; box-sizing: border-box; }
    button { cursor: pointer; }
    button:hover { border-color: #f97316; }
    button.primary { background: #f97316; color: #111827; border-color: #f97316; font-weight: 700; }
    button.danger:hover { border-color: #ef4444; }
    .status-line { margin-top: 12px; font-size: 14px; }
    .jobs { display: grid; gap: 14px; }
    .job { padding: 16px; }
    .job-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
    .badges, .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .badge { display: inline-flex; border-radius: 999px; padding: 4px 9px; font-size: 12px; border: 1px solid rgba(148, 163, 184, 0.3); color: #e5e7eb; background: rgba(31, 41, 55, 0.72); }
    .pending, .pending_review { border-color: #facc15; color: #fde68a; }
    .approved, .publishing { border-color: #38bdf8; color: #bae6fd; }
    .published { border-color: #22c55e; color: #bbf7d0; }
    .rejected, .failed { border-color: #ef4444; color: #fecaca; }
    .content { white-space: pre-wrap; line-height: 1.45; padding: 14px; background: rgba(3, 7, 18, 0.62); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 14px; margin: 12px 0; }
    .meta { font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
    .actions { margin-top: 12px; }
    details { margin-top: 12px; }
    summary { cursor: pointer; color: #fdba74; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: rgba(3, 7, 18, 0.72); border-radius: 12px; padding: 12px; border: 1px solid rgba(148, 163, 184, 0.16); }
    .empty { text-align: center; color: #9ca3af; padding: 42px 16px; }
    @media (max-width: 820px) { body { padding: 14px; } .controls { grid-template-columns: 1fr; } .job-header { display: block; } .actions button { width: 100%; } }
  </style>
</head>
<body>
  <main>
    <h1>RelayPress Admin</h1>
    <div class="subtitle">Valider, rejeter et auditer les jobs issus de Nostr.</div>

    <section class="panel">
      <div class="controls">
        <input id="token" type="password" placeholder="ADMIN_API_TOKEN" autocomplete="off" />
        <select id="status">
          <option value="">Tous les statuts</option>
          <option value="pending">Pending</option>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="publishing">Publishing</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>
        <select id="platform">
          <option value="">Toutes plateformes</option>
          <option value="x">X</option>
          <option value="linkedin">LinkedIn</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="review">Review</option>
        </select>
        <select id="order">
          <option value="desc">Plus récent en haut</option>
          <option value="asc">Plus récent en bas</option>
        </select>
        <button class="primary" id="refresh">Rafraîchir</button>
      </div>
      <div class="status-line" id="statusLine">Initialisation…</div>
    </section>

    <section class="jobs" id="jobs"></section>
  </main>

  <script>
    var tokenInput = document.querySelector('#token');
    var statusInput = document.querySelector('#status');
    var platformInput = document.querySelector('#platform');
    var orderInput = document.querySelector('#order');
    var refreshButton = document.querySelector('#refresh');
    var jobsEl = document.querySelector('#jobs');
    var statusLine = document.querySelector('#statusLine');

    tokenInput.value = localStorage.getItem('relaypress.adminToken') || '';
    tokenInput.addEventListener('input', function () {
      localStorage.setItem('relaypress.adminToken', tokenInput.value.trim());
    });

    function jobUrl(id, suffix) {
      return '/publication-jobs/' + encodeURIComponent(id) + (suffix || '');
    }

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

    function canApprove(job) {
      return ['pending', 'pending_review'].includes(job.status);
    }

    function canReject(job) {
      return ['pending', 'pending_review', 'approved'].includes(job.status);
    }

    async function api(path, options) {
      options = options || {};
      var headers = new Headers(options.headers || {});
      if (options.method && options.method !== 'GET') {
        var token = tokenInput.value.trim();
        if (token) headers.set('Authorization', 'Bearer ' + token);
      }
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      var response = await fetch(path, Object.assign({}, options, { headers: headers }));
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(payload.message || payload.error || ('HTTP ' + response.status));
      }
      return payload;
    }

    async function approveJob(id) {
      await api(jobUrl(id, '/approve'), { method: 'POST' });
      await loadJobs();
    }

    async function rejectJob(id) {
      var reason = prompt('Raison du rejet ?', 'À retravailler avant publication');
      if (reason === null) return;
      await api(jobUrl(id, '/reject'), {
        method: 'POST',
        body: JSON.stringify({ reason: reason })
      });
      await loadJobs();
    }

    async function loadRuns(id, target) {
      target.textContent = 'Chargement…';
      try {
        var payload = await api(jobUrl(id, '/runs?order=' + encodeURIComponent(orderInput.value)));
        target.textContent = JSON.stringify(payload.runs, null, 2);
      } catch (error) {
        target.textContent = 'Erreur: ' + error.message;
      }
    }

    function renderJob(job) {
      var card = document.createElement('article');
      card.className = 'job';
      var runId = 'runs-' + job.id.replace(/[^a-zA-Z0-9]/g, '-');
      var html = '';
      html += '<div class="job-header">';
      html += '<div class="badges">';
      html += '<span class="badge ' + escapeHtml(job.status) + '">' + escapeHtml(job.status) + '</span>';
      html += '<span class="badge">' + escapeHtml(job.platform) + '</span>';
      html += '</div>';
      html += '<div class="meta">Créé: ' + formatDate(job.createdAt) + '<br/>Mis à jour: ' + formatDate(job.updatedAt) + '</div>';
      html += '</div>';
      html += '<div class="content">' + escapeHtml(job.adaptedContent || '') + '</div>';
      html += '<div class="meta">';
      html += '<strong>Job:</strong> ' + escapeHtml(job.id) + '<br/>';
      html += '<strong>Source:</strong> ' + escapeHtml(job.sourceEventId) + '<br/>';
      html += '<strong>External:</strong> ' + escapeHtml(job.externalPostId || '—') + '<br/>';
      html += '<strong>Erreur:</strong> ' + escapeHtml(job.errorMessage || '—');
      html += '</div>';
      html += '<div class="actions">';
      if (canApprove(job)) html += '<button class="primary" data-action="approve">Approuver</button>';
      if (canReject(job)) html += '<button class="danger" data-action="reject">Rejeter</button>';
      html += '<button data-action="runs">Voir les runs</button>';
      html += '<button data-action="copy">Copier ID</button>';
      html += '</div>';
      html += '<details><summary>Détails source</summary><pre>' + escapeHtml(JSON.stringify(job.sourceEvent, null, 2)) + '</pre></details>';
      html += '<details><summary>Historique d’exécution</summary><pre id="' + runId + '">Clique sur “Voir les runs”.</pre></details>';
      card.innerHTML = html;

      var approveButton = card.querySelector('[data-action="approve"]');
      if (approveButton) approveButton.addEventListener('click', async function () {
        try { await approveJob(job.id); } catch (error) { alert(error.message); }
      });

      var rejectButton = card.querySelector('[data-action="reject"]');
      if (rejectButton) rejectButton.addEventListener('click', async function () {
        try { await rejectJob(job.id); } catch (error) { alert(error.message); }
      });

      var runsButton = card.querySelector('[data-action="runs"]');
      if (runsButton) runsButton.addEventListener('click', async function () {
        var target = card.querySelector('#' + CSS.escape(runId));
        await loadRuns(job.id, target);
      });

      var copyButton = card.querySelector('[data-action="copy"]');
      if (copyButton) copyButton.addEventListener('click', async function () {
        await navigator.clipboard.writeText(job.id);
        statusLine.textContent = 'ID copié dans le presse-papiers.';
      });

      return card;
    }

    async function loadJobs() {
      var params = new URLSearchParams();
      params.set('order', orderInput.value);
      params.set('limit', '100');
      if (statusInput.value) params.set('status', statusInput.value);
      if (platformInput.value) params.set('platform', platformInput.value);

      statusLine.textContent = 'Chargement des jobs…';
      jobsEl.innerHTML = '';

      try {
        var payload = await api('/publication-jobs?' + params.toString());
        statusLine.textContent = payload.count + ' job(s), ordre ' + payload.order + '.';
        if (!payload.jobs.length) {
          jobsEl.innerHTML = '<div class="panel empty">Aucun job pour ces filtres.</div>';
          return;
        }
        for (var i = 0; i < payload.jobs.length; i += 1) {
          jobsEl.appendChild(renderJob(payload.jobs[i]));
        }
      } catch (error) {
        statusLine.textContent = 'Erreur: ' + error.message;
      }
    }

    refreshButton.addEventListener('click', loadJobs);
    statusInput.addEventListener('change', loadJobs);
    platformInput.addEventListener('change', loadJobs);
    orderInput.addEventListener('change', loadJobs);

    loadJobs();
  </script>
</body>
</html>`;

export async function registerAdminPage(app: FastifyInstance): Promise<void> {
  app.get("/admin", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(adminHtml);
  });
}
