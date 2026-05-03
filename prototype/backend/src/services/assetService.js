/* ============================================================================
   Asset Service
   ----------------------------------------------------------------------------
   MVP asset contract. Current renderer is procedural, but every game gets a
   manifest so future image/audio generation can plug in without DB changes.
   ========================================================================= */

function buildAssetManifest(gameJSON) {
  const dimension = gameJSON?.metadata?.dimension;
  const base = [
    {
      key: 'player',
      type: 'procedural-shape',
      role: 'player',
      color: gameJSON?.player?.color || 0x38bdf8
    }
  ];

  if (gameJSON?.enemies?.count > 0) {
    base.push({
      key: 'enemy',
      type: 'procedural-shape',
      role: 'enemy',
      color: gameJSON.enemies.color || 0xef4444,
      count: gameJSON.enemies.count
    });
  }

  if (dimension === '3D') {
    base.push({
      key: 'ground',
      type: 'procedural-mesh',
      role: 'world',
      color: gameJSON?.world?.ground?.color || 0x334155
    });
  } else {
    base.push({
      key: 'platform',
      type: 'procedural-shape',
      role: 'level',
      color: 0x334155
    });
  }

  if (gameJSON?.collectibles?.count > 0 || gameJSON?.world?.collectibles?.length > 0) {
    base.push({
      key: 'collectible',
      type: 'procedural-shape',
      role: 'collectible',
      color: gameJSON?.collectibles?.color || 0xfacc15
    });
  }

  return base;
}

module.exports = { buildAssetManifest };
