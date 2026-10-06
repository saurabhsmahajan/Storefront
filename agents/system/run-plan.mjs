// Runs independent subtasks through their specialists. The returned promise
// never rejects: every job ends "answered" or "failed", so the session can
// always be closed as resolved or escalated. Results keep job order.

const message = (err) =>
  err instanceof Error ? err.message : String(err ?? "unknown error");

export async function runPlan(
  jobs,
  { specialists = {}, concurrency = Infinity, timeoutMs = 60000 } = {},
) {
  const t0 = Date.now();
  const now = () => Date.now() - t0;

  // One job. Resolves once, whichever comes first: the specialist or the
  // timeout. A late result is ignored; the timer is always cleared.
  const runOne = (job) =>
    new Promise((resolve) => {
      const startMs = now();
      let timer = null;
      let settled = false;
      const finish = (status, r, error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          id: job.id,
          specialist: job.specialist,
          status,
          r,
          error,
          startMs,
          endMs: now(),
        });
      };

      const fn = Object.hasOwn(specialists, job.specialist)
        ? specialists[job.specialist]
        : null;
      if (typeof fn !== "function") {
        finish("failed", null, `unknown specialist: ${job.specialist}`);
        return;
      }
      timer = setTimeout(() => finish("failed", null, "timeout"), timeoutMs);
      let pending;
      try {
        pending = fn(job.input);
      } catch (err) {
        finish("failed", null, message(err));
        return;
      }
      Promise.resolve(pending).then(
        (r) => finish("answered", r, null),
        (err) => finish("failed", null, message(err)),
      );
    });

  // Worker pool: each worker takes the next job in order until none are left.
  const results = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await runOne(jobs[i]);
    }
  };
  const limit = concurrency >= 1 ? Math.floor(concurrency) : 1;
  const workers = Math.min(limit, jobs.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
