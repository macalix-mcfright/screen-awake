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
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Wake Lock Error: ${err}`);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Access to the Screen Wake Lock feature was denied. This is likely due to a browser permissions policy, which can occur when the app is running in an iframe (like an online editor) or if the feature is disabled in your browser settings.');
      } else {
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