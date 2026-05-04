import type { FastifyInstance } from "fastify";

const adminHtml = String.raw`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RelayPress Admin</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #111827;
      color: #f9fafb;
    }

    body {
      margin: 0;
      padding: 24px;
      background: radial-gradient(circle at top left, #1f2937, #030712 55%);
    }

    main {
      max-width: 1180px;
      margin: 0 auto;
    }

    header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0;
      font-size: 32px;
      letter-spacing: -0.04em;
    }

    .subtitle {
      color: #9ca3af;
      margin-top: 6px;
    }

    .panel, .job {
      background: rgba(17, 24, 39, 0.84);
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 18px;
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.28);
    }

    .panel {
      padding: 16px;
      margin-bottom: 18px;
    }

    .controls {
      display: grid;
      grid-template-columns: 1fr repeat(4, auto);
      gap: 10px;
      align-items: center;
    }

    input, select, button, textarea {
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.32);
      background: rgba(3, 7, 18, 0.82);
      color: #f9fafb;
      padding: 10px 12px;
      font: inherit;
    }

    input[type="password"] {
      width: 100%;
      box-sizing: border-box;
    }

    button {
      cursor: pointer;
      transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
    }

    button:hover {
      transform: translateY(-1px);
      border-color: #f97316;
    }

    button.primary {
      background: #f97316;
      color: #111827;
      border-color: #f97316;
      font-weight: 700;
    }

    button.danger:hover {
      border-color: #ef4444;
    }

    .status-line {
      margin-top: 12px;
      color: #9ca3af;
      font-size: 14px;
    }

    .jobs {
      display: grid;
      gap: 14px;
    }

    .job {
      padding: 16px;
    }

    .job-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 9px;
      font-size: 12px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      color: #e5e7eb;
      background: rgba(31, 41, 55, 0.72);
    }

    .pending, .pending_review { border-color: #facc15; color: #fde68a; }
    .approved, .publishing { border-color: #38bdf8; color: #bae6fd; }
    .published { border-color: #22c55e; color: #bbf7d0; }
    .rejected, .failed { border-color: #ef4444; color: #fecaca; }

    .content {
      white-space: pre-wrap;
      line-height: 1.45;
      padding: 14px;
      background: rgba(3, 7, 18, 0.62);
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 14px;
      margin: 12px 0;
    }

    .meta {
      color: #9ca3af;
      font-size: 13px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    details {
      margin-top: 12px;
    }

    summary {
      cursor: pointer;
      color: #fdba74;
    }

    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      background: rgba(3, 7, 18, 0.72);
      border-radius: 12px;
      padding: 12px;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .empty {
      text-align: center;
      color: #9ca3af;
      padding: 42px 16px;
    }

    @media (max-width: 820px) {
      body { padding: 14px; }
      header { display: block; }
      .controls { grid-template-columns: 1fr; }
      .job-header { display: block; }
      .actions button { width: 100%; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>RelayPress Admin</h1>
        <div class="subtitle">Valider, rejeter et auditer les jobs issus de Nostr.</div>
      </div>
    </header>

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
    const tokenInput = document.querySelector("#token");
    const statusInput = document.querySelector("#status");
    const platformInput = document.querySelector("#platform");
    const orderInput = document.querySelector("#order");
    const refreshButton = document.querySelector("#refresh");
    const jobsEl = document.querySelector("#jobs");
    const statusLine = document.querySelector("#statusLine");

    tokenInput.value = localStorage.getItem("relaypress.adminToken") || "";
    tokenInput.addEventListener("input", () => {
      localStorage.setItem("relaypress.adminToken", tokenInput.value.trim());
    });

    function jobUrl(id, suffix = "") {
      return `/publication-jobs/${encodeURIComponent(id)}${suffix}`;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function formatDate(value) {
      if (!value) return "—";
      return new Date(value).toLocaleString("fr-FR");
    }

    function canApprove(job) {
      return ["pending", "pending_review"].includes(job.status);
    }

    function canReject(job) {
      return ["pending", "pending_review", "approved"].includes(job.status);
    }

    async function api(path, options = {}) {
      const headers = new Headers(options.headers || {});
      if (options.method && options.method !== "GET") {
        const token = tokenInput.value.trim();
        if (token) headers.set("Authorization", `Bearer ${token}`);
      }
      if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      }
      return payload;
    }

    async function approveJob(id) {
      await api(jobUrl(id, "/approve"), { method: "POST" });
      await loadJobs();
    }

    async function rejectJob(id) {
      const reason = prompt("Raison du rejet ?", "À retravailler avant publication");
      if (reason === null) return;
      await api(jobUrl(id, "/reject"), {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await loadJobs();
    }

    async function loadRuns(id, target) {
      target.textContent = "Chargement…";
      try {
        const payload = await api(jobUrl(id, `/runs?order=${orderInput.value}`));
        target.textContent = JSON.stringify(payload.runs, null, 2);
      } catch (error) {
        target.textContent = `Erreur: ${error.message}`;
      }
    }

    function renderJob(job) {
      const card = document.createElement("article");
      card.className = "job";

      const runId = `runs-${job.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
      card.innerHTML = `
        <div class="job-header">
          <div class="badges">
            <span class="badge ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
            <span class="badge">${escapeHtml(job.platform)}</span>
          </div>
          <div class="meta">Créé: ${formatDate(job.createdAt)}<br/>Mis à jour: ${formatDate(job.updatedAt)}</div>
        </div>
        <div class="content">${escapeHtml(job.adaptedContent || "")}</div>
        <div class="meta">
          <strong>Job:</strong> ${escapeHtml(job.id)}<br/>
          <strong>Source:</strong> ${escapeHtml(job.sourceEventId)}<br/>
          <strong>External:</strong> ${escapeHtml(job.externalPostId || "—")}<br/>
          <strong>Erreur:</strong> ${escapeHtml(job.errorMessage || "—")}
        </div>
        <div class="actions">
          ${canApprove(job) ? `<button class="primary" data-action="approve">Approuver</button>` : ""}
          ${canReject(job) ? `<button class="danger" data-action="reject">Rejeter</button>` : ""}
          <button data-action="runs">Voir les runs</button>
          <button data-action="copy">Copier ID</button>
        </div>
        <details>
          <summary>Détails source</summary>
          <pre>${escapeHtml(JSON.stringify(job.sourceEvent, null, 2))}</pre>
        </details>
        <details>
          <summary>Historique d’exécution</summary>
          <pre id="${runId}">Clique sur “Voir les runs”.</pre>
        </details>
      `;

      card.querySelector('[data-action="approve"]')?.addEventListener("click", async () => {
        try {
          await approveJob(job.id);
        } catch (error) {
          alert(error.message);
        }
      });

      card.querySelector('[data-action="reject"]')?.addEventListener("click", async () => {
        try {
          await rejectJob(job.id);
        } catch (error) {
          alert(error.message);
        }
      });

      card.querySelector('[data-action="runs"]')?.addEventListener("click", async () => {
        const target = card.querySelector(`#${CSS.escape(runId)}`);
        await loadRuns(job.id, target);
      });

      card.querySelector('[data-action="copy"]')?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(job.id);
        statusLine.textContent = "ID copié dans le presse-papiers.";
      });

      return card;
    }

    async function loadJobs() {
      const params = new URLSearchParams();
      params.set("order", orderInput.value);
      params.set("limit", "100");
      if (statusInput.value) params.set("status", statusInput.value);
      if (platformInput.value) params.set("platform", platformInput.value);

      statusLine.textContent = "Chargement des jobs…";
      jobsEl.innerHTML = "";

      try {
        const payload = await api(`/publication-jobs?${params.toString()}`);
        statusLine.textContent = `${payload.count} job(s), ordre ${payload.order}.`;

        if (!payload.jobs.length) {
          jobsEl.innerHTML = `<div class="panel empty">Aucun job pour ces filtres.</div>`;
          return;
        }

        for (const job of payload.jobs) {
          jobsEl.appendChild(renderJob(job));
        }
      } catch (error) {
        statusLine.textContent = `Erreur: ${error.message}`;
      }
    }

    refreshButton.addEventListener("click", loadJobs);
    statusInput.addEventListener("change", loadJobs);
    platformInput.addEventListener("change", loadJobs);
    orderInput.addEventListener("change", loadJobs);

    loadJobs();
  </script>
</body>
</html>`;

export async function registerAdminPage(app: FastifyInstance): Promise<void> {
  app.get("/admin", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(adminHtml);
  });
}
