import NetInfo, { NetInfoStateType, type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export type OnlineState = {
  isOnline: boolean;
  type: NetInfoState['type'];
};

export function useOnline(): OnlineState {
  const [state, setState] = useState<OnlineState>({
    isOnline: true,
    type: NetInfoStateType.unknown,
  });

  useEffect(() => {
    let cancelled = false;
    NetInfo.fetch().then((s) => {
      if (cancelled) return;
      setState({ isOnline: !!s.isConnected && s.isInternetReachable !== false, type: s.type });
    });
    const sub = NetInfo.addEventListener((s) => {
      setState({ isOnline: !!s.isConnected && s.isInternetReachable !== false, type: s.type });
    });
    return () => {
      cancelled = true;
      sub();
    };
  }, []);

  return state;
}
