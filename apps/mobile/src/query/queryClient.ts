import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';

let onlineManagerBound = false;

function bindOnlineManager() {
  if (onlineManagerBound) return;
  onlineManagerBound = true;

  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(isOnline);
    });
  });
}

export function createQueryClient() {
  bindOnlineManager();
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      },
    },
  });
}
