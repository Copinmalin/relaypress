import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { db, migrate } from './db.js';
import { generateVariants, listKarakeepItems, listPostizDestinations, submitPostizDraft } from './integrations.js';

const PORT = Number(process.env.PORT ?? 3000);
const sessions = new Map();

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(title, body) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:0 20px}nav{display:flex;gap:16px;margin-bottom:24px}textarea,input,select{width:100%;box-sizing:border-box;padding:8px;margin:6px 0 12px}button{padding:8px 14px}article{border:1px solid #ddd;padding:14px;margin:10px 0;border-radius:8px}.muted{color:#666}pre{white-space:pre-wrap}</style></head><body><nav><a href="/">Inbox</a><a href="/profiles">Profils</a><a href="/settings">Paramètres</a></nav>${body}</body></html>`;
}

function redirect(res, location) { res.writeHead(303, { Location: location }); res.end(); }
function send(res, status, body, type = 'text/html; charset=utf-8') { res.writeHead(status, { 'content-type': type }); res.end(body); }
function cookies(req) { return Object.fromEntries((req.headers.cookie ?? '').split(';').map(x => x.trim()).filter(Boolean).map(x => x.split('=').map(decodeURIComponent))); }
async function form(req) { const chunks = []; for await (const c of req) chunks.push(c); return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString())); }
function sessionUser(req) { return sessions.get(cookies(req).relaypress_session); }
async function requireUser(req, res) { const userId = sessionUser(req); if (!userId) { redirect(res, '/login'); return null; } return userId; }
async function memberWorkspace(userId, workspaceId) { const { rowCount } = await db.query('SELECT 1 FROM workspace_members WHERE user_id=$1 AND workspace_id=$2', [userId, workspaceId]); return rowCount > 0; }

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  if (req.method === 'GET' && path === '/health') return send(res, 200, JSON.stringify({ ok: true, version: '0.2.0' }), 'application/json');

  if (req.method === 'GET' && path === '/login') {
    return send(res, 200, page('Connexion', `<h1>RelayPress</h1><form method="post" action="/login"><label>Email</label><input name="email" type="email" required><button>Entrer</button></form><p class="muted">Authentification MVP volontairement minimale.</p>`));
  }

  if (req.method === 'POST' && path === '/login') {
    const data = await form(req);
    const email = String(data.email ?? '').trim().toLowerCase();
    if (!email) return send(res, 400, 'Email requis');
    const { rows } = await db.query('INSERT INTO users(email) VALUES($1) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id', [email]);
    const token = randomUUID();
    sessions.set(token, rows[0].id);
    res.setHeader('Set-Cookie', `relaypress_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`);
    return redirect(res, '/');
  }

  const userId = await requireUser(req, res);
  if (!userId) return;

  if (req.method === 'POST' && path === '/workspaces') {
    const data = await form(req);
    const { rows } = await db.query('INSERT INTO workspaces(name) VALUES($1) RETURNING id', [data.name]);
    await db.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')", [rows[0].id, userId]);
    return redirect(res, `/profiles?workspace=${rows[0].id}`);
  }

  if (req.method === 'GET' && path === '/') {
    const { rows: workspaces } = await db.query('SELECT w.id,w.name FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_id=$1 ORDER BY w.name', [userId]);
    if (!workspaces.length) return send(res, 200, page('Démarrage', `<h1>Créer le premier workspace</h1><form method="post" action="/workspaces"><input name="name" required><button>Créer</button></form>`));

    const workspaceId = url.searchParams.get('workspace') ?? workspaces[0].id;
    if (!await memberWorkspace(userId, workspaceId)) return send(res, 403, 'Interdit');

    const { rows: profiles } = await db.query('SELECT * FROM profiles WHERE workspace_id=$1 ORDER BY name', [workspaceId]);
    const profileId = url.searchParams.get('profile') ?? profiles[0]?.id;
    if (!profileId) return send(res, 200, page('Inbox', `<h1>Aucun profil</h1><p><a href="/profiles?workspace=${workspaceId}">Créer un profil</a></p>`));

    let sources = [];
    const { rows: integrations } = await db.query("SELECT * FROM integrations WHERE workspace_id=$1 AND kind='karakeep'", [workspaceId]);
    if (integrations[0]?.base_url && integrations[0]?.secret) {
      try { sources = await listKarakeepItems(integrations[0].base_url, integrations[0].secret); }
      catch (error) { console.error(error); }
    }

    const workspaceOptions = workspaces.map(w => `<option value="${esc(w.id)}" ${w.id === workspaceId ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
    const profileOptions = profiles.map(p => `<option value="${esc(p.id)}" ${p.id === profileId ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    const sourceCards = sources.map(s => `<article><strong>${esc(s.title)}</strong><div class="muted">${esc(s.url ?? '')}</div><form method="post" action="/campaigns"><input type="hidden" name="profileId" value="${esc(profileId)}"><input type="hidden" name="sourceType" value="karakeep"><input type="hidden" name="sourceReference" value="${esc(s.id)}"><textarea name="sourceSnapshot" hidden>${esc(JSON.stringify(s))}</textarea><button>Créer une campagne</button></form></article>`).join('') || '<p class="muted">Aucune source Karakeep ou connexion non configurée.</p>';

    return send(res, 200, page('Inbox', `<h1>Inbox</h1><form method="get"><select name="workspace" onchange="this.form.submit()">${workspaceOptions}</select><select name="profile" onchange="this.form.submit()">${profileOptions}</select></form><h2>Karakeep</h2>${sourceCards}<h2>Source manuelle</h2><form method="post" action="/campaigns"><input type="hidden" name="profileId" value="${esc(profileId)}"><select name="sourceType"><option value="url">URL</option><option value="text">Texte</option></select><textarea name="sourceReference" required></textarea><button>Créer une campagne</button></form>`));
  }

  if (req.method === 'GET' && path === '/profiles') {
    const { rows: workspaces } = await db.query('SELECT w.* FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_id=$1 ORDER BY w.name', [userId]);
    const workspaceId = url.searchParams.get('workspace') ?? workspaces[0]?.id ?? '';
    const { rows: profiles } = workspaceId ? await db.query('SELECT * FROM profiles WHERE workspace_id=$1 ORDER BY name', [workspaceId]) : { rows: [] };
    return send(res, 200, page('Profils', `<h1>Profils</h1>${profiles.map(p => `<article><strong>${esc(p.name)}</strong><pre>${esc(p.instructions)}</pre></article>`).join('')}<h2>Nouveau profil</h2><form method="post" action="/profiles"><input type="hidden" name="workspaceId" value="${esc(workspaceId)}"><input name="name" placeholder="Nom" required><input name="language" value="fr"><textarea name="instructions" placeholder="Ton, positionnement, règles, CTA..."></textarea><textarea name="destinations" placeholder='Destinations Postiz JSON, ex. {"linkedin":"integration-id"}'></textarea><button>Créer</button></form>`));
  }

  if (req.method === 'POST' && path === '/profiles') {
    const data = await form(req);
    if (!await memberWorkspace(userId, data.workspaceId)) return send(res, 403, 'Interdit');
    let destinations = {};
    try { destinations = data.destinations ? JSON.parse(data.destinations) : {}; } catch {}
    await db.query('INSERT INTO profiles(workspace_id,name,language,instructions,destinations) VALUES($1,$2,$3,$4,$5)', [data.workspaceId, data.name, data.language || 'fr', data.instructions || '', destinations]);
    return redirect(res, `/profiles?workspace=${data.workspaceId}`);
  }

  if (req.method === 'GET' && path === '/settings') {
    const { rows: workspaces } = await db.query('SELECT w.* FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_id=$1 ORDER BY w.name', [userId]);
    const workspaceId = url.searchParams.get('workspace') ?? workspaces[0]?.id ?? '';
    const { rows: integrations } = workspaceId ? await db.query('SELECT kind,base_url FROM integrations WHERE workspace_id=$1 ORDER BY kind', [workspaceId]) : { rows: [] };
    return send(res, 200, page('Paramètres', `<h1>Paramètres</h1>${integrations.map(i => `<article>${esc(i.kind)} — ${esc(i.base_url ?? 'configuré')}</article>`).join('')}<form method="post" action="/settings/integration"><input type="hidden" name="workspaceId" value="${esc(workspaceId)}"><select name="kind"><option>karakeep</option><option>openai</option><option>postiz</option></select><input name="baseUrl" placeholder="Karakeep: https://... | Postiz: .../public/v1"><input name="secret" type="password" placeholder="Clé API"><button>Enregistrer</button></form><p><a href="/api/postiz/destinations?workspace=${esc(workspaceId)}">Voir les destinations Postiz (JSON)</a></p>`));
  }

  if (req.method === 'POST' && path === '/settings/integration') {
    const data = await form(req);
    if (!await memberWorkspace(userId, data.workspaceId)) return send(res, 403, 'Interdit');
    await db.query(`INSERT INTO integrations(workspace_id,kind,base_url,secret) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,kind) DO UPDATE SET base_url=EXCLUDED.base_url,secret=EXCLUDED.secret,updated_at=now()`, [data.workspaceId, data.kind, data.baseUrl || null, data.secret || null]);
    return redirect(res, `/settings?workspace=${data.workspaceId}`);
  }

  if (req.method === 'POST' && path === '/campaigns') {
    const data = await form(req);
    const { rows: profile } = await db.query('SELECT p.* FROM profiles p JOIN workspace_members m ON m.workspace_id=p.workspace_id WHERE p.id=$1 AND m.user_id=$2', [data.profileId, userId]);
    if (!profile[0]) return send(res, 403, 'Interdit');
    let snapshot = { value: data.sourceReference };
    try { if (data.sourceSnapshot) snapshot = JSON.parse(data.sourceSnapshot); } catch {}
    const { rows } = await db.query('INSERT INTO campaigns(profile_id,created_by,source_type,source_reference,source_snapshot) VALUES($1,$2,$3,$4,$5) RETURNING id', [data.profileId, userId, data.sourceType, data.sourceReference, snapshot]);
    return redirect(res, `/campaigns/${rows[0].id}`);
  }

  const campaignMatch = path.match(/^\/campaigns\/([^/]+)$/);
  if (req.method === 'GET' && campaignMatch) {
    const { rows } = await db.query('SELECT c.*,p.name profile_name,p.instructions,p.destinations,p.workspace_id FROM campaigns c JOIN profiles p ON p.id=c.profile_id JOIN workspace_members m ON m.workspace_id=p.workspace_id WHERE c.id=$1 AND m.user_id=$2', [campaignMatch[1], userId]);
    const campaign = rows[0];
    if (!campaign) return send(res, 404, 'Introuvable');
    const { rows: variants } = await db.query('SELECT * FROM variants WHERE campaign_id=$1 ORDER BY channel', [campaign.id]);
    return send(res, 200, page('Campagne', `<h1>Campagne — ${esc(campaign.profile_name)}</h1><pre>${esc(JSON.stringify(campaign.source_snapshot, null, 2))}</pre><form method="post" action="/campaigns/${esc(campaign.id)}/generate"><textarea name="instruction" placeholder="Angle ou instruction">${esc(campaign.instruction)}</textarea><input name="channels" value="linkedin,x,facebook,nostr"><button>Générer avec OpenAI</button></form><h2>Variantes</h2>${variants.map(v => `<form method="post" action="/variants/${esc(v.id)}"><strong>${esc(v.channel)}</strong><textarea name="content">${esc(v.content)}</textarea><button name="action" value="save">Enregistrer</button> <button name="action" value="submit">Envoyer à Postiz</button></form>`).join('')}`));
  }

  const generateMatch = path.match(/^\/campaigns\/([^/]+)\/generate$/);
  if (req.method === 'POST' && generateMatch) {
    const data = await form(req);
    const { rows } = await db.query('SELECT c.*,p.instructions,p.workspace_id FROM campaigns c JOIN profiles p ON p.id=c.profile_id JOIN workspace_members m ON m.workspace_id=p.workspace_id WHERE c.id=$1 AND m.user_id=$2', [generateMatch[1], userId]);
    const campaign = rows[0];
    if (!campaign) return send(res, 404, 'Introuvable');
    const { rows: integrations } = await db.query("SELECT * FROM integrations WHERE workspace_id=$1 AND kind='openai'", [campaign.workspace_id]);
    const apiKey = integrations[0]?.secret ?? process.env.OPENAI_API_KEY;
    if (!apiKey) return send(res, 400, 'OpenAI non configuré');
    const channels = String(data.channels || '').split(',').map(s => s.trim()).filter(Boolean);
    const generated = await generateVariants({ apiKey, source: campaign.source_snapshot, profileInstructions: campaign.instructions, instruction: data.instruction || '', channels });
    for (const [channel, content] of Object.entries(generated)) {
      await db.query(`INSERT INTO variants(campaign_id,channel,content) VALUES($1,$2,$3) ON CONFLICT(campaign_id,channel) DO UPDATE SET content=EXCLUDED.content,updated_at=now()`, [campaign.id, channel, String(content)]);
    }
    await db.query("UPDATE campaigns SET instruction=$2,status='generated',updated_at=now() WHERE id=$1", [campaign.id, data.instruction || '']);
    return redirect(res, `/campaigns/${campaign.id}`);
  }

  const variantMatch = path.match(/^\/variants\/([^/]+)$/);
  if (req.method === 'POST' && variantMatch) {
    const data = await form(req);
    const { rows } = await db.query('SELECT v.*,c.profile_id,p.workspace_id,p.destinations FROM variants v JOIN campaigns c ON c.id=v.campaign_id JOIN profiles p ON p.id=c.profile_id JOIN workspace_members m ON m.workspace_id=p.workspace_id WHERE v.id=$1 AND m.user_id=$2', [variantMatch[1], userId]);
    const variant = rows[0];
    if (!variant) return send(res, 404, 'Introuvable');
    await db.query('UPDATE variants SET content=$2,updated_at=now() WHERE id=$1', [variant.id, data.content]);
    if (data.action === 'submit') {
      const { rows: integrations } = await db.query("SELECT * FROM integrations WHERE workspace_id=$1 AND kind='postiz'", [variant.workspace_id]);
      const integration = integrations[0];
      if (!integration?.base_url || !integration?.secret) return send(res, 400, 'Postiz non configuré');
      const integrationId = variant.destinations?.[variant.channel];
      if (!integrationId) return send(res, 400, `Destination Postiz absente pour ${variant.channel}`);
      const result = await submitPostizDraft(integration.base_url, integration.secret, integrationId, variant.channel, data.content);
      const first = Array.isArray(result) ? result[0] : result;
      await db.query("UPDATE variants SET status='submitted',external_id=$2,updated_at=now() WHERE id=$1", [variant.id, String(first?.postId ?? '')]);
    }
    return redirect(res, `/campaigns/${variant.campaign_id}`);
  }

  if (req.method === 'GET' && path === '/api/postiz/destinations') {
    const workspaceId = url.searchParams.get('workspace') ?? '';
    if (!await memberWorkspace(userId, workspaceId)) return send(res, 403, 'Interdit');
    const { rows } = await db.query("SELECT * FROM integrations WHERE workspace_id=$1 AND kind='postiz'", [workspaceId]);
    const integration = rows[0];
    if (!integration?.base_url || !integration?.secret) return send(res, 400, JSON.stringify({ error: 'Postiz non configuré' }), 'application/json');
    return send(res, 200, JSON.stringify(await listPostizDestinations(integration.base_url, integration.secret), null, 2), 'application/json');
  }

  return send(res, 404, 'Introuvable');
}

await migrate();
http.createServer((req, res) => route(req, res).catch(error => {
  console.error(error);
  if (!res.headersSent) send(res, 500, 'Erreur interne'); else res.end();
})).listen(PORT, '0.0.0.0', () => console.log(`RelayPress V0.2 listening on :${PORT}`));
