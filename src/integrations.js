function trimSlash(value) { return value.replace(/\/$/, ''); }

async function jsonOrThrow(response, name) {
  if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
  return response.json();
}

export async function listKarakeepItems(baseUrl, apiKey) {
  const response = await fetch(`${trimSlash(baseUrl)}/api/v1/bookmarks?limit=30&sortOrder=desc&includeContent=false`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
  });
  const body = await jsonOrThrow(response, 'Karakeep');
  return (body.bookmarks ?? []).map((item) => ({
    id: String(item.id),
    title: item.title ?? item.content?.title ?? item.url ?? item.content?.url ?? 'Sans titre',
    url: item.url ?? item.content?.url,
    excerpt: item.summary ?? item.note ?? item.content?.description,
    createdAt: item.createdAt
  }));
}

function responseText(body) {
  for (const output of body.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('OpenAI: aucune sortie texte');
}

export async function generateVariants({ apiKey, source, profileInstructions, instruction, channels }) {
  const prompt = [
    'Tu rédiges des contenus de communication multi-canal.',
    `Profil éditorial:\n${profileInstructions || '(aucune instruction spécifique)'}`,
    `Source:\n${JSON.stringify(source)}`,
    `Instruction utilisateur:\n${instruction || '(aucune)'}`,
    `Canaux: ${channels.join(', ')}`,
    'Retourne uniquement un objet JSON valide. Chaque clé est un canal demandé et chaque valeur est le texte prêt à relire. Aucun markdown autour du JSON.'
  ].join('\n\n');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? 'gpt-5-mini', input: prompt })
  });
  const body = await jsonOrThrow(response, 'OpenAI');
  return JSON.parse(responseText(body));
}

export async function listPostizDestinations(baseUrl, apiKey) {
  const response = await fetch(`${trimSlash(baseUrl)}/integrations`, {
    headers: { Authorization: apiKey, Accept: 'application/json' }
  });
  return jsonOrThrow(response, 'Postiz');
}

export async function submitPostizDraft(baseUrl, apiKey, integrationId, channel, content) {
  const response = await fetch(`${trimSlash(baseUrl)}/posts`, {
    method: 'POST',
    headers: { Authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'draft',
      posts: [{
        integration: { id: integrationId },
        value: [{ content, image: [] }],
        settings: { __type: channel }
      }]
    })
  });
  return jsonOrThrow(response, 'Postiz');
}
