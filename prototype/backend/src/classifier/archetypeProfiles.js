/* ============================================================================
   Archetype Profiles
   ----------------------------------------------------------------------------
   Stage 3A: lightweight archetype catalog used by classifierService to anchor
   the Game Brief prompt. Profiles describe perspective/camera/physics defaults
   so the AI brief stays consistent with the runtime contract.

   dimensionLock semantics:
     '2D' | '3D' | 'hybrid' — archetype only fits this exact dimension.
     'any'                  — dimension-neutral; dimension travels with the
                              classification but the archetype id is preserved
                              (e.g. grid_logic stays grid_logic when locked 3D).
   ========================================================================= */

const ARCHETYPES = Object.freeze({
  platformer_2d: {
    id: 'platformer_2d',
    dimension: '2D',
    dimensionLock: '2D',
    perspective: 'side-view',
    gravity: 'down-y',
    camera: { type: 'side-scroll', defaults: 'follow player on X, soft Y lerp' },
    physics: { mode: 'arcade', notes: 'gravity-down, jump impulse, ground colliders' },
    defaultSystems: ['physicsSync', 'camera', 'behavior', 'ui'],
    defaultControls: {
      primary: 'Keyboard arrows/WASD plus Space to jump',
      mobile: 'On-screen left/right pad and a jump button',
      bindings: { moveLeft: ['ArrowLeft', 'KeyA'], moveRight: ['ArrowRight', 'KeyD'], jump: ['Space', 'ArrowUp', 'KeyW'] }
    },
    commonEntities: ['player', 'platform', 'ground', 'enemy', 'collectible', 'hazard', 'goal'],
    commonAssetRoles: ['player', 'platform', 'enemy', 'collectible', 'ui'],
    commonFailureModes: ['camera with no target', 'platforms with no collider', 'jump too weak', 'no death/reset rule'],
    briefGuidance: 'Side-scrolling platformer with gravity-down physics. Keep platforms reachable from the player\'s jump arc and include at least one win condition.'
  },

  top_down_2d: {
    id: 'top_down_2d',
    dimension: '2D',
    dimensionLock: '2D',
    perspective: 'top-down',
    gravity: 'none',
    camera: { type: 'top-down', defaults: 'follow player from above, no gravity offset' },
    physics: { mode: 'arcade', notes: 'no vertical gravity; 2D movement on the XY plane' },
    defaultSystems: ['physicsSync', 'camera', 'behavior', 'ui'],
    defaultControls: {
      primary: 'WASD or arrow keys for 8-way movement; optional aim/attack key',
      mobile: 'Virtual joystick for movement; tap or button for action',
      bindings: { moveLeft: ['ArrowLeft', 'KeyA'], moveRight: ['ArrowRight', 'KeyD'], moveUp: ['ArrowUp', 'KeyW'], moveDown: ['ArrowDown', 'KeyS'] }
    },
    commonEntities: ['player', 'enemy', 'wall', 'collectible', 'projectile'],
    commonAssetRoles: ['player', 'enemy', 'environment', 'collectible', 'ui'],
    commonFailureModes: ['applying gravity by accident', 'walls without colliders', 'enemies that ignore player tag'],
    briefGuidance: 'Top-down 2D world with no gravity. Movement is 8-way. Walls and rooms define the playfield.'
  },

  grid_logic: {
    id: 'grid_logic',
    dimension: '2D',
    dimensionLock: 'any',
    perspective: 'screen',
    gravity: 'none',
    camera: { type: 'static', defaults: 'fixed view of the whole board' },
    physics: { mode: 'none', notes: 'no physics; cells/tiles updated by discrete rules' },
    defaultSystems: ['behavior', 'ui'],
    defaultControls: {
      primary: 'Click or arrow keys to select/move a piece',
      mobile: 'Tap and drag to select/move a piece',
      bindings: { select: ['Enter', 'Space'], moveLeft: ['ArrowLeft'], moveRight: ['ArrowRight'], moveUp: ['ArrowUp'], moveDown: ['ArrowDown'] }
    },
    commonEntities: ['cell', 'piece', 'board', 'ui'],
    commonAssetRoles: ['piece', 'board', 'ui'],
    commonFailureModes: ['adding gravity', 'using continuous physics for discrete pieces', 'inventing animation systems'],
    briefGuidance: 'Discrete-grid logic puzzle. No physics or gravity; the board updates by turn or input. Win condition is a board state.'
  },

  tower_defense: {
    id: 'tower_defense',
    dimension: '2D',
    dimensionLock: 'any',
    perspective: 'top-down',
    gravity: 'none',
    camera: { type: 'static-overview', defaults: 'fixed map view, optional pan/zoom' },
    physics: { mode: 'arcade', notes: 'wave spawners and path-following; light or no collision' },
    defaultSystems: ['spawner', 'behavior', 'ui'],
    defaultControls: {
      primary: 'Click to place a tower; hotkeys for tower types and wave start',
      mobile: 'Tap to place a tower; tap UI button to start a wave',
      bindings: { startWave: ['Space'], placeTower: ['Enter'] }
    },
    commonEntities: ['tower', 'enemy', 'path', 'spawner', 'base', 'ui'],
    commonAssetRoles: ['tower', 'enemy', 'environment', 'ui'],
    commonFailureModes: ['no wave/spawner', 'no path for enemies', 'towers without targeting behavior'],
    briefGuidance: 'Tower defense with discrete waves and a fixed enemy path. Player places towers to stop waves before they reach the base.'
  },

  ui_heavy: {
    id: 'ui_heavy',
    dimension: '2D',
    dimensionLock: 'any',
    perspective: 'screen',
    gravity: 'none',
    camera: { type: 'static', defaults: 'no world camera; UI fills the screen' },
    physics: { mode: 'none', notes: 'no world physics; interaction is via UI elements' },
    defaultSystems: ['ui', 'behavior'],
    defaultControls: {
      primary: 'Mouse/click to interact with UI elements',
      mobile: 'Tap UI elements',
      bindings: { confirm: ['Enter', 'Space'] }
    },
    commonEntities: ['button', 'panel', 'text', 'choice'],
    commonAssetRoles: ['ui', 'icon'],
    commonFailureModes: ['adding a physics player', 'using a side-scroll camera', 'requiring an unused jump binding'],
    briefGuidance: 'UI-driven game. No physics player. Progress is by reading text and pressing UI buttons.'
  },

  platformer_3d: {
    id: 'platformer_3d',
    dimension: '3D',
    dimensionLock: '3D',
    perspective: 'side-view-3d',
    gravity: 'down-y',
    camera: { type: 'follow-3d', defaults: 'lerp behind/above the player on a side-on axis' },
    physics: { mode: 'rigid', notes: 'gravity-down Y; rigid bodies for player and platforms' },
    defaultSystems: ['physicsSync', 'camera', 'behavior', 'ui'],
    defaultControls: {
      primary: 'WASD or arrows to move; Space to jump',
      mobile: 'Virtual pad to move; jump button',
      bindings: { moveLeft: ['ArrowLeft', 'KeyA'], moveRight: ['ArrowRight', 'KeyD'], jump: ['Space', 'ArrowUp', 'KeyW'] }
    },
    commonEntities: ['player', 'platform', 'ground', 'enemy', 'collectible', 'goal'],
    commonAssetRoles: ['player', 'platform', 'enemy', 'collectible'],
    commonFailureModes: ['camera with no target', 'platforms without colliders', 'mismatched gravity sign'],
    briefGuidance: '3D platformer with side-on camera and gravity-down physics. Player jumps between 3D platforms toward a clear goal.'
  },

  third_person_3d: {
    id: 'third_person_3d',
    dimension: '3D',
    dimensionLock: '3D',
    perspective: 'third-person',
    gravity: 'down-y',
    camera: { type: 'third-person-follow', defaults: 'behind player, slight up-tilt, lerp on movement' },
    physics: { mode: 'rigid', notes: 'gravity-down Y; capsule or box rigid body for player' },
    defaultSystems: ['physicsSync', 'camera', 'behavior', 'ui'],
    defaultControls: {
      primary: 'WASD to move; mouse to look (if implemented); Space to jump',
      mobile: 'Virtual joystick to move; tap button to act',
      bindings: { moveLeft: ['ArrowLeft', 'KeyA'], moveRight: ['ArrowRight', 'KeyD'], moveUp: ['ArrowUp', 'KeyW'], moveDown: ['ArrowDown', 'KeyS'], jump: ['Space'] }
    },
    commonEntities: ['player', 'environment', 'enemy', 'collectible', 'goal'],
    commonAssetRoles: ['player', 'environment', 'enemy', 'collectible'],
    commonFailureModes: ['no cameraTarget', 'ground without collider', 'free-look without bounds'],
    briefGuidance: 'Third-person 3D game. Camera follows the player from behind. Ground and walls are solid 3D meshes.'
  },

  first_person_3d: {
    id: 'first_person_3d',
    dimension: '3D',
    dimensionLock: '3D',
    perspective: 'first-person',
    gravity: 'down-y',
    camera: { type: 'first-person', defaults: 'camera attached to the player\'s head' },
    physics: { mode: 'rigid', notes: 'gravity-down Y; capsule body for player; mouse-look optional' },
    defaultSystems: ['physicsSync', 'camera', 'behavior', 'ui'],
    defaultControls: {
      primary: 'WASD to move; mouse to look; Space to jump; click to act',
      mobile: 'Two virtual sticks (move + look); button to act',
      bindings: { moveLeft: ['KeyA'], moveRight: ['KeyD'], moveUp: ['KeyW'], moveDown: ['KeyS'], jump: ['Space'] }
    },
    commonEntities: ['player', 'environment', 'enemy', 'pickup'],
    commonAssetRoles: ['environment', 'enemy', 'pickup', 'ui'],
    commonFailureModes: ['third-person camera by accident', 'no player collider', 'no clear goal'],
    briefGuidance: 'First-person 3D game. The camera is mounted on the player. Player navigates a 3D world toward a clear objective.'
  },

  top_down_3d: {
    id: 'top_down_3d',
    dimension: '3D',
    dimensionLock: '3D',
    perspective: 'top-down',
    gravity: 'down-y',
    camera: { type: 'top-down-3d', defaults: 'orthographic-ish camera above the player' },
    physics: { mode: 'rigid', notes: 'minimal vertical motion; movement on the XZ plane' },
    defaultSystems: ['physicsSync', 'camera', 'behavior', 'ui'],
    defaultControls: {
      primary: 'WASD for 8-way movement; click or key to act',
      mobile: 'Virtual joystick to move; tap to act',
      bindings: { moveLeft: ['ArrowLeft', 'KeyA'], moveRight: ['ArrowRight', 'KeyD'], moveUp: ['ArrowUp', 'KeyW'], moveDown: ['ArrowDown', 'KeyS'] }
    },
    commonEntities: ['player', 'enemy', 'wall', 'collectible'],
    commonAssetRoles: ['player', 'enemy', 'environment', 'collectible'],
    commonFailureModes: ['adding a jump mechanic', 'side-view camera by mistake'],
    briefGuidance: 'Top-down 3D world. Camera looks down at the player. Movement is on the ground plane; jumping is rare.'
  },

  vehicle_3d: {
    id: 'vehicle_3d',
    dimension: '3D',
    dimensionLock: '3D',
    perspective: 'third-person',
    gravity: 'down-y',
    camera: { type: 'chase-cam', defaults: 'behind-and-above the vehicle, lerp with speed' },
    physics: { mode: 'rigid', notes: 'gravity-down; rigid body for vehicle; acceleration/steering forces' },
    defaultSystems: ['physicsSync', 'camera', 'behavior', 'ui'],
    defaultControls: {
      primary: 'W/S accelerate-brake; A/D steer; Space optional handbrake',
      mobile: 'Touch buttons or tilt for steer; tap for accelerate',
      bindings: { accelerate: ['ArrowUp', 'KeyW'], brake: ['ArrowDown', 'KeyS'], steerLeft: ['ArrowLeft', 'KeyA'], steerRight: ['ArrowRight', 'KeyD'] }
    },
    commonEntities: ['vehicle', 'track', 'obstacle', 'checkpoint'],
    commonAssetRoles: ['vehicle', 'environment', 'obstacle', 'ui'],
    commonFailureModes: ['no track/path', 'using jump bindings', 'camera not following vehicle'],
    briefGuidance: '3D vehicle game. Player drives along a track or in an arena. Steering and acceleration replace walking controls.'
  },

  hybrid_2_5d: {
    id: 'hybrid_2_5d',
    dimension: 'hybrid',
    dimensionLock: 'hybrid',
    perspective: 'side-view',
    gravity: 'down-y',
    camera: { type: 'side-scroll-3d', defaults: 'side-on with depth; 3D meshes on a 2D plane' },
    physics: { mode: 'rigid', notes: '2D gameplay on the XY plane; 3D visuals; gravity-down Y' },
    defaultSystems: ['physicsSync', 'camera', 'behavior', 'ui'],
    defaultControls: {
      primary: 'A/D or arrows to move; Space to jump',
      mobile: 'Virtual left/right and a jump button',
      bindings: { moveLeft: ['ArrowLeft', 'KeyA'], moveRight: ['ArrowRight', 'KeyD'], jump: ['Space', 'ArrowUp', 'KeyW'] }
    },
    commonEntities: ['player', 'platform', 'enemy', 'collectible'],
    commonAssetRoles: ['player', 'platform', 'enemy', 'collectible', 'ui'],
    commonFailureModes: ['full 3D free-look', 'depth movement when only XY is intended'],
    briefGuidance: '2.5D hybrid: 2D side-scrolling gameplay rendered with 3D meshes. Movement is constrained to the side-on plane.'
  },

  on_rails_shooter: {
    id: 'on_rails_shooter',
    dimension: '3D',
    dimensionLock: '3D',
    perspective: 'first-person',
    gravity: 'none',
    camera: { type: 'rails-cam', defaults: 'camera moves along a fixed path; player aims on screen' },
    physics: { mode: 'none', notes: 'no player physics; targets and projectiles use lightweight motion' },
    defaultSystems: ['spawner', 'camera', 'behavior', 'ui'],
    defaultControls: {
      primary: 'Mouse to aim; click to shoot',
      mobile: 'Touch to aim and shoot',
      bindings: { shoot: ['Space'] }
    },
    commonEntities: ['target', 'enemy', 'projectile', 'pathNode', 'ui'],
    commonAssetRoles: ['enemy', 'environment', 'projectile', 'ui'],
    commonFailureModes: ['adding player movement', 'free-roam camera', 'no spawn pattern'],
    briefGuidance: 'On-rails shooter: the camera travels a fixed path. The player only aims and shoots; no free movement.'
  }
});

function getArchetypeProfile(id) {
  return ARCHETYPES[id] || null;
}

function listArchetypesForDimension(dimension) {
  const normalized = normalizeDimension(dimension);
  return Object.values(ARCHETYPES).filter((profile) => profile.dimensionLock === normalized || profile.dimensionLock === 'any');
}

function listAllArchetypeIds() {
  return Object.keys(ARCHETYPES);
}

function isKnownArchetypeId(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(ARCHETYPES, id);
}

function normalizeDimension(value) {
  const text = String(value || '').toLowerCase().trim();
  if (text === '2d') return '2D';
  if (text === '3d') return '3D';
  if (text === 'hybrid') return 'hybrid';
  return '';
}

module.exports = {
  ARCHETYPES,
  getArchetypeProfile,
  listArchetypesForDimension,
  listAllArchetypeIds,
  isKnownArchetypeId,
  normalizeDimension
};
