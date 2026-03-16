/**
 * Promise-based mutex: serializes async critical sections to prevent TOCTOU races.
 */

export function createMutex() {
  let chain = Promise.resolve();
  return function withLock(fn) {
    const result = chain.then(fn);
    chain = result.catch(() => {});
    return result;
  };
}
