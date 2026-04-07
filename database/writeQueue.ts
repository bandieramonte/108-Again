let queue: Promise<void> = Promise.resolve();

export function enqueueWrite(
  fn: () => Promise<void> | void
): Promise<void> {

  const result = queue.then(() => Promise.resolve(fn()));

  queue = result.catch(() => {});

  return result;
}