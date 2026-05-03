/* ============================================================================
   Application Constants
   ========================================================================= */

module.exports = {
  // Game generation defaults
  GENERATION: {
    MAX_RETRIES: 3,
    GENERATION_TIMEOUT_MS: 30000,
    MAX_PROMPT_LENGTH: 2000,
    MAX_EDIT_PROMPT_LENGTH: 500
  },

  // Valid game genres
  VALID_GENRES_2D: ['platformer', 'shooter', 'runner', 'breakout', 'rpg', 'puzzle'],
  VALID_GENRES_3D: ['explorer-fp', 'adventure-tp', 'platformer-3d', 'runner-3d', 'racing', 'flying'],

  VALID_DIMENSIONS: ['2D', '3D'],

  // HTTP
  HEADERS: {
    REQUEST_ID: 'x-request-id',
    RESPONSE_TIME: 'x-response-time'
  }
};
