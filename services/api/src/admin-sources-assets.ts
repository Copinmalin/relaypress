import type { FastifyInstance } from "fastify";

const js = String.raw`var providerInput=document.querySelector('#provider');
var statusInput=document.querySelector('#status');
var refreshButton=document.querySelector('#refresh');
var cards=document.querySelector('#cards');
var statusLine=document.querySelector('#statusLine');
providerInput.value=localStorage.getItem('relaypress.sourceProvider')||'';
statusInput.value=localStorage.getItem('relaypress.sourceStatus')||'';
function esc(v){return String(v==null?'':v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function date(v){return v?new Date(v).toLocaleString('fr-FR'):'—'}
function token(){return (localStorage.getItem('relaypress.adminToken')||'').trim()}
function excerpt(v){var t=String(v||'').replace(/\s+/g,' ').trim();return t.length>420?t.slice(0,420)+'…':t}
async function api(path,opts){opts=opts||{};var t=token();if(!t)throw new Error('ADMIN_API_TOKEN absent dans localStorage');var r=await fetch(path,{method:opts.method||'GET',headers:{Authorization:'Bearer '+t}});var p=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(p.message||p.error||('HTTP '+r.status));return p}
async function setStatus(id,action){await api('/source-items/'+encodeURIComponent(id)+'/'+action,{method:'POST'});await loadSources()}
function card(item){var m=item.metadata&&typeof item.metadata==='object'?item.metadata:{};var html='';html+='<article class="job">';html+='<div class="job-header"><div class="badges"><span class="badge">'+esc(item.provider)+'</span><span class="badge '+esc(item.status)+'">'+esc(item.status)+'</span></div><div class="meta">Mis à jour: '+esc(date(item.updatedAt))+'</div></div>';html+='<h2>'+esc(item.title||'Sans titre')+'</h2>';html+='<div class="meta"><strong>URL:</strong> <a href="'+esc(item.sourceUrl)+'" target="_blank" rel="noreferrer">'+esc(item.sourceUrl)+'</a></div>';html+='<div class="content">'+esc(excerpt(item.content))+'</div>';html+='<div class="meta"><strong>Date source:</strong> '+esc(String(m.publishedAt||'—'))+'<br/><strong>Image:</strong> '+esc(String(m.imageUrl||'—'))+'</div>';html+='<div class="actions"><button class="primary" data-action="select">Sélectionner</button><button data-action="ignore">Ignorer</button><button data-action="copy">Copier URL</button></div>';html+='<details><summary>Métadonnées</summary><pre>'+esc(JSON.stringify(m,null,2))+'</pre></details></article>';var wrap=document.createElement('div');wrap.innerHTML=html;var node=wrap.firstElementChild;node.querySelector('[data-action="select"]').addEventListener('click',function(){setStatus(item.id,'select').catch(function(e){alert(e.message)})});node.querySelector('[data-action="ignore"]').addEventListener('click',function(){setStatus(item.id,'ignore').catch(function(e){alert(e.message)})});node.querySelector('[data-action="copy"]').addEventListener('click',function(){navigator.clipboard.writeText(item.sourceUrl);statusLine.textContent='URL copiée.'});return node}
async function loadSources(){localStorage.setItem('relaypress.sourceProvider',providerInput.value);localStorage.setItem('relaypress.sourceStatus',statusInput.value);cards.innerHTML='';statusLine.textContent='Chargement…';try{var params=new URLSearchParams();params.set('limit','100');if(providerInput.value)params.set('provider',providerInput.value);if(statusInput.value)params.set('status',statusInput.value);var payload=await api('/source-items?'+params.toString());statusLine.textContent=payload.count+' source(s).';if(!payload.items.length){cards.innerHTML='<div class="panel empty">Aucune source pour ces filtres.</div>';return}payload.items.forEach(function(item){cards.appendChild(card(item))})}catch(e){statusLine.textContent='Erreur: '+e.message}}
providerInput.addEventListener('change',loadSources);statusInput.addEventListener('change',loadSources);refreshButton.addEventListener('click',loadSources);loadSources();`;

export async function registerAdminSourcesAssets(app: FastifyInstance): Promise<void> {
  app.get("/assets/admin-sources.js", async (_request, reply) => reply.header("cache-control", "no-store").type("application/javascript; charset=utf-8").send(js));
}
