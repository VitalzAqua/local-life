import { useEffect } from 'react';

export const usePollingEffect = (
  callback,
  intervalMs,
  enabled = true,
  { runImmediately = true } = {}
) => {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    if (runImmediately) {
      callback();
    }

    const intervalId = setInterval(callback, intervalMs);

    return () => clearInterval(intervalId);
  }, [callback, intervalMs, enabled, runImmediately]);
};
