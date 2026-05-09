/* ============================================================================
   Asset Service
   ----------------------------------------------------------------------------
   MVP asset contract. Legacy generated games still use procedural placeholders,
   but the manifest can now include local library assets when the registry has
   useful matches.
   ========================================================================= */

const { getRecommendedAssetsForGameBrief, buildGameAssetManifest } = require('./assetRegistryService');

function buildAssetManifest(gameJSON) {
  const dimension = gameJSON?.metadata?.dimension;
  const engine = dimension === '3D' ? 'three' : 'phaser';
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

  const registryAssets = findRegistryAssetsForGame(gameJSON, engine);
  return [...base, ...registryAssets];
}

function findRegistryAssetsForGame(gameJSON, engine) {
  try {
    const recommended = getRecommendedAssetsForGameBrief({
      prompt: gameJSON?.metadata?.description,
      gameType: gameJSON?.metadata?.genre,
      dimension: gameJSON?.metadata?.dimension,
      theme: gameJSON?.level?.theme || gameJSON?.audio?.theme,
      assetPlan: {
        assetsToGenerate: [
          gameJSON?.collectibles?.type,
          gameJSON?.enemies?.behavior,
          gameJSON?.metadata?.genre
        ].filter(Boolean)
      }
    }, 8);

    return buildGameAssetManifest(recommended.map((asset) => asset.id), engine).assets;
  } catch {
    return [];
  }
}

module.exports = { buildAssetManifest };
