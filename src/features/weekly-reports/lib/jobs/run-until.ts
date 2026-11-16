/**
 * A bounded pool for the jobs that call the model: the weekly report writer
 * and the Goal proposal job. Starts no new item after the deadline, so a run
 * ends inside its route's time limit and leaves the rest for the next run.
 */

/**
 * Runs `work` over the items, `limit` at a time, starting an item only while
 * the clock is before `deadline` (epoch ms). Returns the results of the items
 * started; the rest are left for the next run.
 */
export async function runUntil<T, R>(
  items: readonly T[],
  limit: number,
  deadline: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  let next = 0;
  const lane = async (): Promise<R[]> => {
    let done: R[] = [];
    while (next < items.length && Date.now() < deadline) {
      const item = items[next];
      next += 1;
      done = [...done, await work(item)];
    }
    return done;
  };
  const lanes = await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return lanes.flat();
}
