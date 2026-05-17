/* ============================================================================
   Classifier — barrel export
   ----------------------------------------------------------------------------
   Public surface: classifyArchetype and a few profile helpers.
   keywordRules stays private by convention.
   ========================================================================= */

const { classifyArchetype } = require('./classifierService');
const {
  ARCHETYPES,
  getArchetypeProfile,
  listArchetypesForDimension,
  listAllArchetypeIds,
  isKnownArchetypeId
} = require('./archetypeProfiles');

module.exports = {
  classifyArchetype,
  ARCHETYPES,
  getArchetypeProfile,
  listArchetypesForDimension,
  listAllArchetypeIds,
  isKnownArchetypeId
};
