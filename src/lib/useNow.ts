// Re-renders on an interval and returns the wall clock, for countdowns (MFA rotation, lockout).
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
