/**
 * Calls `fn` up to `attempts` times, waiting `delayMs` between calls, while
 * `shouldRetry` says its result is worth asking again for. Returns the first
 * result that is not, or the last one.
 */
export async function retryWhile<T>(
  fn: () => Promise<T>,
  shouldRetry: (result: T) => boolean,
  { attempts, delayMs }: { attempts: number; delayMs: number },
): Promise<T> {
  const result = await fn();
  if (attempts <= 1 || !shouldRetry(result)) return result;
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  return retryWhile(fn, shouldRetry, { attempts: attempts - 1, delayMs });
}
