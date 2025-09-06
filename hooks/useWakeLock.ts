
import { useState, useEffect, useRef, useCallback } from 'react';

export const useWakeLock = () => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wakeLockSentinel = useRef<WakeLockSentinel | null>(null);
  const userIntentRef = useRef(false); // Tracks the user's desired state

  const isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator;

  const requestWakeLock = useCallback(async () => {
    if (!isSupported) return;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.current = sentinel;

      sentinel.onrelease = () => {
        // Sentinel was released by the system, e.g., tab was hidden.
        // We don't change userIntentRef here as the user's intent remains.
        setIsActive(false);
        wakeLockSentinel.current = null;
      };

      setIsActive(true);
      setError(null); // Clear previous errors on success
    } catch (err) {
      userIntentRef.current = false; // If request fails, intent can't be fulfilled.
      
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        // This is a common permission issue in some environments, not an unexpected application error.
        // We handle it gracefully by informing the user in the UI instead of logging a console error.
        setError('Wake Lock permission was denied by the browser. The app will still function, but your screen may turn off. This can happen if the feature is disabled by a permissions policy.');
      } else {
        // For other, truly unexpected errors, we log them to the console for debugging.
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Wake Lock Error: ${err}`);
        setError(`An unexpected error occurred: ${errorMessage}`);
      }
      setIsActive(false);
    }
  }, [isSupported]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockSentinel.current) {
      try {
        await wakeLockSentinel.current.release();
        // The onrelease event will correctly handle state changes.
      } catch (err) {
        const errorMessage = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error(`Failed to release wake lock: ${errorMessage}`);
        setError(errorMessage);
      }
    }
  }, []);

  const acquireLock = useCallback(() => {
    if (!isActive) {
      userIntentRef.current = true;
      setError(null); // Clear error on new attempt
      requestWakeLock();
    }
  }, [isActive, requestWakeLock]);

  const releaseLock = useCallback(() => {
    if (isActive) {
      userIntentRef.current = false;
      releaseWakeLock();
    }
  }, [isActive, releaseWakeLock]);


  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = () => {
      // Re-acquire lock if page is visible and user intended it to be active.
      if (userIntentRef.current && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Clean up the lock when the component unmounts.
      if (wakeLockSentinel.current) {
        releaseWakeLock();
      }
    };
  }, [isSupported, requestWakeLock, releaseWakeLock]);

  return { isSupported, isActive, error, acquireLock, releaseLock };
};
