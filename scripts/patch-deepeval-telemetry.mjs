import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "/* bjak-telemetry-stubs */";
const telemetryPath = path.join(
  fileURLToPath(new URL("../node_modules/deepeval/dist/telemetry.js", import.meta.url)),
);

if (!existsSync(telemetryPath)) {
  process.exit(0);
}
const source = readFileSync(telemetryPath, "utf8");
if (source.includes(MARKER)) {
  process.exit(0);
}

const stub = `
${MARKER}
function noop() {}
exports.Entrypoint = exports.Entrypoint || {};
exports.LoginMethod = exports.LoginMethod || {};
exports.LoginOutcome = exports.LoginOutcome || {};
exports.LoginPromptSurface = exports.LoginPromptSurface || {};
exports.beginEvaluationRun = exports.beginEvaluationRun || noop;
exports.captureCliCommand = exports.captureCliCommand || noop;
exports.captureConversationSimulatorRun = exports.captureConversationSimulatorRun || noop;
exports.captureEvaluationRun = exports.captureEvaluationRun || noop;
exports.captureLoginEvent = exports.captureLoginEvent || noop;
exports.captureLoginPromptShown = exports.captureLoginPromptShown || noop;
exports.flush = exports.flush || noop;
exports.inComponentScope = exports.inComponentScope || (() => false);
exports.recordGolden = exports.recordGolden || noop;
exports.recordLoginCompleted = exports.recordLoginCompleted || noop;
exports.recordMetric = exports.recordMetric || noop;
exports.recordTestCase = exports.recordTestCase || noop;
exports.recordTracingIntegration = exports.recordTracingIntegration || noop;
exports.setLoggedInWith = exports.setLoggedInWith || noop;
exports.withComponentScope = exports.withComponentScope || ((...args) => {
  const fn = args.find((arg) => typeof arg === "function");
  return fn ? fn() : undefined;
});
`;

writeFileSync(telemetryPath, `${source.trimEnd()}\n${stub}`);
