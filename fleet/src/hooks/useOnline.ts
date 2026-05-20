import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Network status hook. Returns `true` if device has internet reachability,
 * `false` if offline. Initial state assumed online until first NetInfo event.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Fetch initial state synchronously after mount (async under the hood).
    let cancelled = false;
    NetInfo.fetch().then((state) => {
      if (!cancelled) setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    // Subscribe to subsequent changes.
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return online;
}
