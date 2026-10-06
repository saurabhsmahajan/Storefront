import { classifyIntent } from "../layer2/classify.mjs";

// Plain classifier Router: one model call, one label, no tools, no data.
export async function routeByClassifier(message) {
  const t0 = Date.now();
  const { intent, raw } = await classifyIntent(message);
  return {
    route: intent ?? "unknown",
    raw,
    modelCalls: 1,
    ms: Date.now() - t0,
  };
}
