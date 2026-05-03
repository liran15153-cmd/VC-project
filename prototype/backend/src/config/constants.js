/* ============================================================================
   Application Constants
   ========================================================================= */

module.exports = {
  // Token costs (matches frontend)
  TOKEN_COSTS: {
    NEW_GAME: 5,
    EDIT_GAME: 2,
    PROMPT_QUERY: 1,
    MANUAL_SAVE: 1
  },

  SUBSCRIPTION_TIERS: {
    FREE: 'free',
    PRO: 'pro',
    ENTERPRISE: 'enterprise'
  },

  USER_ROLES: {
    USER: 'user',
    ADMIN: 'admin'
  },

  // Game generation defaults
  GENERATION: {
    MAX_RETRIES: 3,                  // Max validation loop iterations
    GENERATION_TIMEOUT_MS: 30000,    // Max wait for AI provider response
    MAX_PROMPT_LENGTH: 2000,         // User prompt max chars
    MAX_EDIT_PROMPT_LENGTH: 500
  },

  // Valid game genres
  VALID_GENRES_2D: ['platformer', 'shooter', 'runner', 'breakout', 'rpg', 'puzzle'],
  VALID_GENRES_3D: ['explorer-fp', 'adventure-tp', 'platformer-3d', 'runner-3d', 'racing', 'flying'],

  VALID_DIMENSIONS: ['2D', '3D'],

  // Analytics event types
  EVENT_TYPES: {
    GAME_CREATED: 'game_created',
    GAME_EDITED: 'game_edited',
    GAME_DELETED: 'game_deleted',
    GENERATION_STARTED: 'generation_started',
    GENERATION_SUCCEEDED: 'generation_succeeded',
    GENERATION_FAILED: 'generation_failed',
    VALIDATION_FAILED: 'validation_failed',
    OPENAI_CALLED: 'openai_called',
    MCQ_GENERATED: 'mcq_generated',
    TOKENS_SPENT: 'tokens_spent',
    USER_REGISTERED: 'user_registered',
    USER_LOGGED_IN: 'user_logged_in',
    GAME_DOWNLOADED: 'game_downloaded'
  },

  // HTTP
  HEADERS: {
    REQUEST_ID: 'x-request-id',
    RESPONSE_TIME: 'x-response-time'
  }
};
