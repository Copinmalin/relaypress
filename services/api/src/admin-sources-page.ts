import type { FastifyInstance } from "fastify";

const html = String.raw`<!doctype html>
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
    <div class="subtitle">Sources éditoriales récupérées avant sélection humaine.</div>
    <p><a href="/admin">Retour aux jobs</a></p>
    <section class="panel">
      <div class="controls">
        <select id="provider"><option value="">Tous providers</option><option value="btcbreakdown">BTC Breakdown</option></select>
        <select id="status"><option value="">Tous statuts</option><option value="imported">Imported</option><option value="selected">Selected</option><option value="ignored">Ignored</option><option value="converted">Converted</option></select>
        <button class="primary" id="refresh">Rafraîchir</button>
      </div>
      <div class="status" id="statusLine">Initialisation…</div>
      <div class="hint">Utilise le token déjà enregistré dans l’admin principal.</div>
    </section>
    <section class="jobs" id="cards"></section>
  </main>
  <script src="/assets/admin-sources.js"></script>
</body>
</html>`;

export async function registerAdminSourcesPage(app: FastifyInstance): Promise<void> {
  app.get("/admin/sources", async (_request, reply) => reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(html));
}
