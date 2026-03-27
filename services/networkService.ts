import NetInfo from "@react-native-community/netinfo";

let isOnline = true;
let listeners: (() => void)[] = [];

export function initializeNetworkListener() {
    NetInfo.addEventListener((state) => {
        const wasOffline = !isOnline;
        isOnline = !!state.isConnected;

        if (isOnline && wasOffline) {
            // notify listeners when coming back online
            listeners.forEach((l) => l());
        }
    });
}

export function getIsOnline() {
    return isOnline;
}

export function subscribeOnline(callback: () => void) {
    listeners.push(callback);
    return () => {
        listeners = listeners.filter((l) => l !== callback);
    };
}