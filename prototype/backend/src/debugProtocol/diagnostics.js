/* ============================================================================
 * Debug Protocol — Public API
 * ----------------------------------------------------------------------------
 * Derived from OpenGame (Apache-2.0). See third_party/opengame/NOTICE.
 *   Original concept: agent-test/debug-skill/src/debug-loop.ts (REPEAT loop)
 *   Adaptations: Stage 1 is detection only. We do NOT run a verify → diagnose
 *     → repair loop, we do NOT call any LLM, and we do NOT mutate the input.
 *     We just walk the validated GameDefinition and report what looks off.
 * ----------------------------------------------------------------------------
 * Caller pattern (see prototype/backend/src/services/engineGenerationService.js):
 *
 *   const { runDebugDiagnostics, summarizeDiagnostics } = require('../debugProtocol/diagnostics');
 *   const report = runDebugDiagnostics(validated.data, {
 *     schemaResult: { ok: true },
 *     normalizationWarnings: validated.warnings
 *   });
 *   logger.info(summarizeDiagnostics(report), 'GameDefinition diagnostics');
 * ========================================================================= */

'use strict';

const path = require('node:path');
const fs = require('node:fs');

const { runAllChecks } = require('./validator');
const { SEVERITY } = require('./types');

let cachedSeedProtocol = null;

function loadSeedProtocol() {
  if (cachedSeedProtocol) return cachedSeedProtocol;
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'seed-protocol.json'), 'utf8');
    cachedSeedProtocol = JSON.parse(raw);
  } catch (err) {
    cachedSeedProtocol = { version: 0, entries: [] };
  }
  return cachedSeedProtocol;
}

/**
 * Run all Stage 1 deterministic diagnostics on a validated GameDefinition.
 *
 * @param {object} definition           Already-validated GameDefinition data
 *                                      (from validateEngineGameDefinitionSafe).
 * @param {object} [context]            Optional context for the report.
 * @param {object} [context.schemaResult]
 *                                      { ok, errors? } from schema validation.
 * @param {Array}  [context.normalizationWarnings]
 *                                      Warnings emitted by the normalizer.
 * @returns {{
 *   ran: boolean,
 *   schemaOk: boolean,
 *   diagnostics: Array<object>,
 *   counts: { error: number, warning: number, total: number },
 *   normalizationWarningCount: number,
 *   schemaErrorCount: number
 * }}
 */
function runDebugDiagnostics(definition, context = {}) {
  const schemaResult = context.schemaResult || { ok: true };
  const normalizationWarnings = Array.isArray(context.normalizationWarnings) ? context.normalizationWarnings : [];

  if (!schemaResult.ok || !definition || typeof definition !== 'object') {
    return {
      ran: false,
      schemaOk: !!schemaResult.ok,
      diagnostics: [],
      counts: { error: 0, warning: 0, total: 0 },
      normalizationWarningCount: normalizationWarnings.length,
      schemaErrorCount: Array.isArray(schemaResult.errors) ? schemaResult.errors.length : 0
    };
  }

  const diagnostics = runAllChecks(definition);
  return {
    ran: true,
    schemaOk: true,
    diagnostics,
    counts: countBySeverity(diagnostics),
    normalizationWarningCount: normalizationWarnings.length,
    schemaErrorCount: 0
  };
}

function countBySeverity(diagnostics) {
  let error = 0;
  let warning = 0;
  for (const d of diagnostics) {
    if (d.severity === SEVERITY.ERROR) error += 1;
    else if (d.severity === SEVERITY.WARNING) warning += 1;
  }
  return { error, warning, total: diagnostics.length };
}

/**
 * Reduce a diagnostic report to a log-friendly summary object.
 * Use this as the pino logger payload — it omits jsonPointer/expected/actual
 * detail to keep log lines reasonable.
 */
function summarizeDiagnostics(report) {
  if (!report) return { ran: false };
  return {
    ran: report.ran,
    schemaOk: report.schemaOk,
    schemaErrorCount: report.schemaErrorCount,
    normalizationWarningCount: report.normalizationWarningCount,
    diagnostics: {
      ...report.counts,
      codes: report.diagnostics.map((d) => d.code)
    }
  };
}

/**
 * Pretty-print a report for human consumption (CLI debug, test output).
 * Each diagnostic is one line: `[severity] CODE - message (jsonPointer)`.
 */
function formatDiagnosticsReport(report) {
  if (!report) return '<no report>';
  const lines = [];
  lines.push(`schemaOk=${report.schemaOk}  normalizationWarnings=${report.normalizationWarningCount}  diagnostics=${report.counts.total} (errors=${report.counts.error}, warnings=${report.counts.warning})`);
  for (const d of report.diagnostics) {
    lines.push(`  [${d.severity.toUpperCase()}] ${d.code} - ${d.message}${d.jsonPointer ? ` (${d.jsonPointer})` : ''}`);
  }
  return lines.join('\n');
}

/**
 * Build the concise diagnostics summary used in API responses.
 * Returns { errorCount, warningCount, codes: Record<string, number> }.
 *
 * @param {Array<object>} diagnostics   Array of diagnostic records.
 */
function buildDiagnosticsSummary(diagnostics = []) {
  const codes = {};
  let errorCount = 0;
  let warningCount = 0;
  for (const d of diagnostics) {
    if (d.severity === SEVERITY.ERROR) errorCount += 1;
    else if (d.severity === SEVERITY.WARNING) warningCount += 1;
    codes[d.code] = (codes[d.code] || 0) + 1;
  }
  return { errorCount, warningCount, codes };
}

module.exports = {
  runDebugDiagnostics,
  summarizeDiagnostics,
  formatDiagnosticsReport,
  loadSeedProtocol,
  buildDiagnosticsSummary
};
