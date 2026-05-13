// Live smoke test against the running backend: drive /brief/generate then
// /engine/from-brief for one dimension, and check the returned GameDefinition
// for the merge-gate criteria.
const BASE = process.env.SMOKE_BASE || 'http://localhost:3000/api';

function fail(msg) {
  console.error('  FAIL ' + msg);
  process.exitCode = 1;
}

function pass(msg) {
  console.log('  PASS ' + msg);
}

async function postJSON(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, body: json, raw: text };
}

function collectAssetUrls(definition) {
  if (!definition || !Array.isArray(definition.assets)) return [];
  return definition.assets.map((a) => a && a.url).filter(Boolean);
}

function isRegistryUrl(url) {
  if (typeof url !== 'string') return false;
  return url.startsWith('/assets/library/') || url.startsWith('/public/assets/library/');
}

async function runDimension({ label, dimension, gameType, prompt, expectedFlags }) {
  console.log('--- ' + label + ' ---');
  const briefRes = await postJSON('/brief/generate', { prompt, gameType, dimension });
  if (briefRes.status !== 200) {
    fail('brief/generate ' + briefRes.status + ' ' + briefRes.raw.slice(0, 200));
    return;
  }
  pass('brief/generate 200');
  const brief = briefRes.body.brief;

  const engineRes = await postJSON('/engine/from-brief', {
    prompt, answers: {}, gameType, dimension, brief, debug: true,
  });
  if (engineRes.status !== 200) {
    fail('engine/from-brief ' + engineRes.status + ' ' + engineRes.raw.slice(0, 400));
    return;
  }
  pass('engine/from-brief 200');

  const def = engineRes.body.gameDefinition;
  if (!def || typeof def !== 'object') {
    fail('gameDefinition missing');
    return;
  }
  pass('gameDefinition present');

  const meta = engineRes.body.meta || {};
  if (!('normalizationWarningCount' in meta)) fail('meta.normalizationWarningCount missing');
  else pass('meta.normalizationWarningCount = ' + meta.normalizationWarningCount);

  if (Array.isArray(expectedFlags)) {
    for (const [flag, want] of expectedFlags) {
      const got = def.engine?.[flag];
      if (got === want) pass('engine.' + flag + ' = ' + want);
      else fail('engine.' + flag + ' = ' + got + ' (expected ' + want + ')');
    }
  }

  const urls = collectAssetUrls(def);
  pass('asset urls: ' + urls.length);
  let invented = 0;
  for (const url of urls) {
    if (!isRegistryUrl(url)) {
      invented++;
      console.log('    invented:', url);
    }
  }
  if (invented === 0) pass('no off-registry asset urls');
  else fail(invented + ' off-registry asset urls');

  const tool = engineRes.body.debug?.toolCalling || engineRes.body.meta?.toolCalling;
  if (tool) {
    console.log('  tool: used=' + tool.used + ' attempts=' + meta.attempts + ' duration=' + meta.durationMs + 'ms model=' + meta.model);
  } else {
    console.log('  attempts=' + meta.attempts + ' duration=' + meta.durationMs + 'ms model=' + meta.model);
  }
}

(async () => {
  const dim = process.argv[2];
  if (dim === '2D') {
    await runDimension({
      label: '2D platformer',
      dimension: '2D',
      gameType: 'platformer',
      prompt: 'Tiny 2D platformer: hop between platforms, collect coins, avoid spikes.',
      expectedFlags: [['enable2D', true]],
    });
  } else if (dim === '3D') {
    await runDimension({
      label: '3D adventure',
      dimension: '3D',
      gameType: 'adventure-tp',
      prompt: 'Small 3D third-person adventure: walk around a low-poly forest and pick up shards.',
      expectedFlags: [['enable3D', true]],
    });
  } else if (dim === 'hybrid') {
    await runDimension({
      label: 'hybrid runner',
      dimension: 'hybrid',
      gameType: 'runner',
      prompt: 'Hybrid runner: 3D world with Phaser HUD overlay and mobile tap controls.',
      expectedFlags: [['enable2D', true], ['enable3D', true]],
    });
  } else {
    console.error('usage: node smoke-flow.mjs <2D|3D|hybrid>');
    process.exit(2);
  }
})();
