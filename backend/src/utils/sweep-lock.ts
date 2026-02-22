/**
 * In-process mutex for sweep jobs.
 * Prevents concurrent runs of the same sweep (cron + manual API trigger).
 */

const held = new Set<string>();

export async function withSweepLock<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (held.has(name)) {
    throw new SweepLockError(name);
  }
  held.add(name);
  try {
    return await fn();
  } finally {
    held.delete(name);
  }
}

export class SweepLockError extends Error {
  constructor(name: string) {
    super(`Sweep "${name}" is already running`);
    this.name = 'SweepLockError';
  }
}
