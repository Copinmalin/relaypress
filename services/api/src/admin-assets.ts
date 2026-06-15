import type { FastifyInstance } from "fastify";

const adminCss = String.raw`:root { color-scheme: dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #030712; color: #f9fafb; }
body { margin: 0; padding: 24px; background: radial-gradient(circle at top left, #1f2937, #030712 55%); }
main { max-width: 1180px; margin: 0 auto; }
h1 { margin: 0; font-size: 32px; letter-spacing: -0.04em; }
h2 { margin: 0 0 10px; font-size: 20px; }
.subtitle, .hint, .status, .meta { color: #9ca3af; }
.panel, .job { background: rgba(17, 24, 39, 0.88); border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 18px; box-shadow: 0 18px 45px rgba(0,0,0,0.28); }
.panel { padding: 16px; margin: 18px 0; }
.controls { display: grid; grid-template-columns: 1fr repeat(5, auto); gap: 10px; align-items: center; }
input, select, button, textarea { border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.32); background: rgba(3, 7, 18, 0.82); color: #f9fafb; padding: 10px 12px; font: inherit; }
input[type="checkbox"] { accent-color: #f97316; }
textarea { width: 100%; min-height: 110px; box-sizing: border-box; resize: vertical; line-height: 1.45; }
button { cursor: pointer; }
button:hover { border-color: #f97316; }
button.primary { background: #f97316; color: #111827; border-color: #f97316; font-weight: 700; }
button.danger:hover { border-color: #ef4444; }
button[disabled] { opacity: .45; cursor: not-allowed; }
.bulk, .platforms, .badges, .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.bulk { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(148, 163, 184, .16); }
.platforms { margin: 10px 0; }
.jobs { display: grid; gap: 14px; }
.job { padding: 16px; }
.job-header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.badge { display: inline-flex; border-radius: 999px; padding: 4px 9px; font-size: 12px; border: 1px solid rgba(148, 163, 184, .3); background: rgba(31, 41, 55, .72); }
.pending, .pending_review, .drafted { border-color: #facc15; color: #fde68a; }
.approved, .publishing { border-color: #38bdf8; color: #bae6fd; }
.published { border-color: #22c55e; color: #bbf7d0; }
.rejected, .failed { border-color: #ef4444; color: #fecaca; }
.archived { border-color: #94a3b8; color: #cbd5e1; }
.content, pre { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; padding: 12px; background: rgba(3, 7, 18, .62); border: 1px solid rgba(148, 163, 184, .16); border-radius: 14px; }
.compare { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
.box { border-radius: 14px; border: 1px solid rgba(148, 163, 184, .18); background: rgba(15, 23, 42, .54); padding: 12px; min-width: 0; }
.box.adapted { border-color: rgba(249, 115, 22, .32); }
.box-title { display: flex; justify-content: space-between; gap: 10px; font-weight: 700; margin-bottom: 8px; }
.count { color: #9ca3af; font-size: 12px; font-weight: 400; }
.preview { margin: 12px 0; padding: 12px; border-radius: 14px; background: rgba(15, 23, 42, .72); border: 1px solid rgba(34, 197, 94, .32); }
.preview.warn { border-color: rgba(250, 204, 21, .52); }
.preview.error { border-color: rgba(239, 68, 68, .58); }
.preview-message { margin-top: 5px; color: #cbd5e1; font-size: 13px; }
.preview.warn .preview-message { color: #fde68a; }
.preview.error .preview-message { color: #fecaca; }
details { margin-top: 12px; }
summary { cursor: pointer; color: #fdba74; }
.empty { text-align: center; padding: 42px 16px; }
@media (max-width: 980px) { body { padding: 14px; } .controls, .compare { grid-template-columns: 1fr; } .job-header { display: block; } .actions button, .bulk button { width: 100%; } }`;

const adminJs = String.raw`var tokenInput = document.querySelector('#token');
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

function hasToken() { return tokenInput.value.trim().length > 0; }
function esc(value) { return String(value == null ? '' : value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function date(value) { return value ? new Date(value).toLocaleString('fr-FR') : '—'; }
function count(value) { return Array.from(String(value || '')).length; }
function countLabel(value) { var n = count(value); return n + (n > 1 ? ' caractères' : ' caractère'); }
function jobUrl(id, suffix) { return '/publication-jobs/' + encodeURIComponent(id) + suffix; }
function sourceFor(job) { return String(job.sourceContent || (job.sourceEvent && job.sourceEvent.content) || job.adaptedContent || '').trim(); }
function selectedIds() { return Array.from(document.querySelectorAll('input[name="jobSelect"]:checked')).map(function (input) { return input.value; }); }
function archivableInputs() { return Array.from(document.querySelectorAll('input[name="jobSelect"]')); }
function updateTokenHint() { tokenHint.textContent = hasToken() ? 'Token présent.' : 'Token absent : aucune donnée éditoriale ne sera affichée.'; }
function updateStatusAvailability() { var custom = viewInput.value === 'custom'; statusInput.disabled = !custom; if (!custom) statusInput.value = ''; }
function saveFilters() { localStorage.setItem('relaypress.view', viewInput.value); localStorage.setItem('relaypress.status', statusInput.value); localStorage.setItem('relaypress.platform', platformInput.value); localStorage.setItem('relaypress.order', orderInput.value); }
function updateSelectionStatus() { var selected = selectedIds().length; var total = archivableInputs().length; selectionStatus.textContent = selected + ' / ' + total + ' job(s) terminé(s) sélectionné(s).'; archiveSelectedButton.disabled = selected === 0; selectAllArchivable.checked = total > 0 && selected === total; selectAllArchivable.indeterminate = selected > 0 && selected < total; }
function buildJobsQuery() { var params = new URLSearchParams(); params.set('order', orderInput.value); params.set('limit', '100'); if (viewInput.value === 'todo') params.set('view', 'todo'); if (viewInput.value === 'archived') params.set('view', 'archived'); if (viewInput.value === 'custom' && statusInput.value) params.set('status', statusInput.value); if (platformInput.value) params.set('platform', platformInput.value); return params; }
async function api(path, options) { options = options || {}; var token = tokenInput.value.trim(); if (!token) throw new Error('ADMIN_API_TOKEN manquant dans l’interface'); var headers = new Headers(options.headers || {}); headers.set('Authorization', 'Bearer ' + token); if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json'); var response = await fetch(path, Object.assign({}, options, { headers: headers })); var payload = await response.json().catch(function () { return {}; }); if (!response.ok) throw new Error(payload.message || payload.error || ('HTTP ' + response.status)); return payload; }
function preview(platform, content) { var text = String(content || '').trim(); var messages = []; var level = 'ok'; if (!text) { level = 'error'; messages.push('Contenu vide.'); } if (text.includes('/publish') || text.includes('#publish') || text.includes('#relaypress')) { if (level !== 'error') level = 'warn'; messages.push('Commande ou tag de routage encore visible.'); } if (platform === 'x' && count(text) > 140) { if (level !== 'error') level = 'warn'; messages.push('X dépasse 140 caractères.'); } if (platform === 'instagram') { if (level !== 'error') level = 'warn'; messages.push('Instagram : média non géré pour le moment.'); } if (!messages.length) messages.push('OK pour validation éditoriale mock.'); return '<div class="preview ' + esc(level) + '"><strong>Prévisualisation ' + esc(platform) + '</strong> · ' + esc(countLabel(text)) + messages.map(function (message) { return '<div class="preview-message">' + esc(message) + '</div>'; }).join('') + '<div class="content">' + esc(text || '—') + '</div></div>'; }
function canApprove(job) { return ['pending','pending_review'].includes(job.status) && !job.externalPostId && !job.publishedAt; }
function canReject(job) { return ['pending','pending_review','approved'].includes(job.status) && !job.externalPostId && !job.publishedAt; }
function canEdit(job) { return ['pending','pending_review','drafted','rejected','failed'].includes(job.status) && !job.externalPostId && !job.publishedAt; }
function canRetry(job) { return job.status === 'failed' && !job.externalPostId && !job.publishedAt; }
function canReset(job) { return ['rejected','failed'].includes(job.status) && !job.externalPostId && !job.publishedAt; }
function canArchive(job) { return ['published','rejected','failed'].includes(job.status); }
function canReadapt(job) { return ['pending','pending_review','rejected','failed'].includes(job.status) && !job.externalPostId && !job.publishedAt; }
function canGenerate(job) { return ['pending_review','drafted'].includes(job.status) && !job.externalPostId && !job.publishedAt; }
function generationLabel(job) { if (!job.generationMode) return '—'; return job.generationMode + (job.generationModel ? ' · ' + job.generationModel : ''); }
async function createManualDraft() { var content = draftContent.value.trim(); var platforms = Array.from(document.querySelectorAll('input[name="draftPlatform"]:checked')).map(function (input) { return input.value; }); if (!content) return alert('Le brouillon est vide.'); if (!platforms.length) return alert('Sélectionne au moins une plateforme.'); draftStatus.textContent = 'Création…'; try { var payload = await api('/publication-jobs/manual-draft', { method: 'POST', body: JSON.stringify({ content: content, platforms: platforms }) }); draftStatus.textContent = payload.count + ' job(s) créés.'; draftContent.value = ''; viewInput.value = 'todo'; await loadJobs(); } catch (error) { draftStatus.textContent = 'Erreur: ' + error.message; } }
async function action(id, suffix, confirmText) { if (confirmText && !confirm(confirmText)) return; await api(jobUrl(id, suffix), { method: 'POST' }); await loadJobs(); }
async function updateContent(id, content) { await api(jobUrl(id, '/content'), { method: 'POST', body: JSON.stringify({ content: content }) }); await loadJobs(); }
async function generateJob(id) { var instruction = prompt('Instruction courte pour la génération ?', 'Réécrire clairement sans publier ni approuver'); if (instruction === null) return; var payload = await api(jobUrl(id, '/generate'), { method: 'POST', body: JSON.stringify({ instruction: instruction, mode: 'mock' }) }); await loadJobs(); statusLine.textContent = 'Génération IA: ' + payload.generation.mode + (payload.generation.model ? ' · ' + payload.generation.model : '') + (payload.generation.warnings.length ? ' · warning(s): ' + payload.generation.warnings.join(', ') : ''); }
async function rejectJob(id) { var reason = prompt('Raison du rejet ?', 'À retravailler avant publication'); if (reason === null) return; await api(jobUrl(id, '/reject'), { method: 'POST', body: JSON.stringify({ reason: reason }) }); await loadJobs(); }
async function loadRuns(id, target) { target.textContent = 'Chargement…'; try { var payload = await api(jobUrl(id, '/runs?order=' + encodeURIComponent(orderInput.value))); target.textContent = JSON.stringify(payload.runs, null, 2); } catch (error) { target.textContent = 'Erreur: ' + error.message; } }
async function archiveSelected() { var ids = selectedIds(); if (!ids.length) return; if (!confirm('Archiver ' + ids.length + ' job(s) sélectionné(s) ?')) return; var ok = 0; var fail = 0; for (var i = 0; i < ids.length; i += 1) { try { await api(jobUrl(ids[i], '/archive'), { method: 'POST' }); ok += 1; } catch (_error) { fail += 1; } } statusLine.textContent = ok + ' archivé(s), ' + fail + ' erreur(s).'; await loadJobs(); }
function renderJob(job) { var original = sourceFor(job); var adapted = String(job.adaptedContent || '').trim(); var editorId = 'editor-' + job.id.replace(/[^a-zA-Z0-9]/g, '-'); var runsId = 'runs-' + job.id.replace(/[^a-zA-Z0-9]/g, '-'); var differs = original !== adapted; var html = ''; html += '<article class="job">'; html += '<div class="job-header"><div class="badges">'; if (canArchive(job)) html += '<label class="badge"><input type="checkbox" name="jobSelect" value="' + esc(job.id) + '" /> archiver</label>'; html += '<span class="badge ' + esc(job.status) + '">' + esc(job.status) + '</span><span class="badge">' + esc(job.platform) + '</span><span class="badge">' + esc(job.sourceEventId ? 'nostr' : 'manual') + '</span>'; html += '</div><div class="meta">Créé: ' + date(job.createdAt) + '<br/>Mis à jour: ' + date(job.updatedAt) + '</div></div>'; html += '<details ' + (differs ? 'open' : '') + '><summary>Comparer source originale / version adaptée</summary><div class="compare"><div class="box"><div class="box-title">Source originale <span class="count">' + esc(countLabel(original)) + '</span></div><div class="content">' + esc(original || '—') + '</div></div><div class="box adapted"><div class="box-title">Version adaptée <span class="count" data-count="adapted">' + esc(countLabel(adapted)) + '</span></div><div class="content" data-content="adapted">' + esc(adapted || '—') + '</div></div></div><div class="hint">' + (differs ? 'Les deux contenus diffèrent : vérifie que l’adaptation respecte l’intention source.' : 'Source et version adaptée sont identiques ou proches.') + '</div></details>'; if (canEdit(job)) html += '<textarea id="' + editorId + '">' + esc(adapted) + '</textarea>'; html += '<div data-preview="job">' + preview(job.platform, adapted) + '</div>'; html += '<div class="meta"><strong>Job:</strong> ' + esc(job.id) + '<br/><strong>External:</strong> ' + esc(job.externalPostId || '—') + '<br/><strong>Erreur / warning métier:</strong> ' + esc(job.errorMessage || '—') + '<br/><strong>Génération IA:</strong> ' + esc(generationLabel(job)) + '</div>'; html += '<div class="actions">'; if (canEdit(job)) html += '<button class="primary" data-action="save">Enregistrer le texte</button>'; if (canGenerate(job)) html += '<button data-action="generate">Générer / réécrire</button>'; if (canReadapt(job)) html += '<button data-action="readapt">Réadapter depuis la source</button>'; if (canApprove(job)) html += '<button class="primary" data-action="approve">Approuver</button>'; if (canRetry(job)) html += '<button class="primary" data-action="retry">Retry</button>'; if (canReset(job)) html += '<button data-action="reset">Remettre en review</button>'; if (canReject(job)) html += '<button class="danger" data-action="reject">Rejeter</button>'; if (canArchive(job)) html += '<button data-action="archive">Archiver</button>'; html += '<button data-action="runs">Voir les runs</button><button data-action="copy">Copier ID</button>'; html += '</div><details><summary>Détails source</summary><pre>' + esc(JSON.stringify(job.sourceEvent, null, 2)) + '</pre></details><details><summary>Historique d’exécution</summary><pre id="' + runsId + '">Clique sur “Voir les runs”.</pre></details></article>'; var wrap = document.createElement('div'); wrap.innerHTML = html; var card = wrap.firstElementChild; var editor = card.querySelector('#' + CSS.escape(editorId)); if (editor) editor.addEventListener('input', function () { var value = editor.value; var previewTarget = card.querySelector('[data-preview="job"]'); var contentTarget = card.querySelector('[data-content="adapted"]'); var countTarget = card.querySelector('[data-count="adapted"]'); if (previewTarget) previewTarget.innerHTML = preview(job.platform, value); if (contentTarget) contentTarget.textContent = value.trim() || '—'; if (countTarget) countTarget.textContent = countLabel(value); }); var select = card.querySelector('input[name="jobSelect"]'); if (select) select.addEventListener('change', updateSelectionStatus); var save = card.querySelector('[data-action="save"]'); if (save && editor) save.addEventListener('click', function () { updateContent(job.id, editor.value).catch(function (error) { alert(error.message); }); }); var generated = card.querySelector('[data-action="generate"]'); if (generated) generated.addEventListener('click', function () { generateJob(job.id).catch(function (error) { alert(error.message); }); }); var readapt = card.querySelector('[data-action="readapt"]'); if (readapt) readapt.addEventListener('click', function () { action(job.id, '/readapt', 'Réadapter depuis la source originale ? Les modifications manuelles actuelles seront remplacées.').catch(function (error) { alert(error.message); }); }); var approve = card.querySelector('[data-action="approve"]'); if (approve) approve.addEventListener('click', function () { action(job.id, '/approve').catch(function (error) { alert(error.message); }); }); var retry = card.querySelector('[data-action="retry"]'); if (retry) retry.addEventListener('click', function () { action(job.id, '/retry', 'Relancer ce job en publication ?').catch(function (error) { alert(error.message); }); }); var reset = card.querySelector('[data-action="reset"]'); if (reset) reset.addEventListener('click', function () { action(job.id, '/reset-review', 'Remettre ce job en pending_review ?').catch(function (error) { alert(error.message); }); }); var reject = card.querySelector('[data-action="reject"]'); if (reject) reject.addEventListener('click', function () { rejectJob(job.id).catch(function (error) { alert(error.message); }); }); var archive = card.querySelector('[data-action="archive"]'); if (archive) archive.addEventListener('click', function () { action(job.id, '/archive', 'Archiver ce job ?').catch(function (error) { alert(error.message); }); }); var runs = card.querySelector('[data-action="runs"]'); if (runs) runs.addEventListener('click', function () { loadRuns(job.id, card.querySelector('#' + CSS.escape(runsId))); }); var copy = card.querySelector('[data-action="copy"]'); if (copy) copy.addEventListener('click', function () { navigator.clipboard.writeText(job.id); statusLine.textContent = 'ID copié.'; }); return card; }
async function loadJobs() { updateStatusAvailability(); updateTokenHint(); saveFilters(); var params = buildJobsQuery(); jobsEl.innerHTML = ''; statusLine.textContent = 'Chargement…'; try { var payload = await api('/publication-jobs?' + params.toString()); statusLine.textContent = payload.count + ' job(s).'; if (!payload.jobs.length) { jobsEl.innerHTML = '<div class="panel empty">Aucun job pour ces filtres.</div>'; updateSelectionStatus(); return; } payload.jobs.forEach(function (job) { jobsEl.appendChild(renderJob(job)); }); updateSelectionStatus(); } catch (error) { statusLine.textContent = 'Erreur: ' + error.message; updateSelectionStatus(); } }
tokenInput.addEventListener('input', function () { localStorage.setItem('relaypress.adminToken', tokenInput.value.trim()); updateTokenHint(); });
createDraftButton.addEventListener('click', createManualDraft);
archiveSelectedButton.addEventListener('click', archiveSelected);
selectAllArchivable.addEventListener('change', function () { var checked = selectAllArchivable.checked; archivableInputs().forEach(function (input) { input.checked = checked; }); updateSelectionStatus(); });
refreshButton.addEventListener('click', loadJobs);
viewInput.addEventListener('change', loadJobs);
statusInput.addEventListener('change', loadJobs);
platformInput.addEventListener('change', loadJobs);
orderInput.addEventListener('change', loadJobs);
updateStatusAvailability();
updateTokenHint();
updateSelectionStatus();
loadJobs();`;

export async function registerAdminAssets(app: FastifyInstance): Promise<void> {
  app.get("/assets/admin.css", async (_request, reply) => {
    return reply.header("cache-control", "no-store").type("text/css; charset=utf-8").send(adminCss);
  });

  app.get("/assets/admin.js", async (_request, reply) => {
    return reply.header("cache-control", "no-store").type("application/javascript; charset=utf-8").send(adminJs);
  });
}
