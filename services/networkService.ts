import NetInfo from "@react-native-community/netinfo";

// Start conservatively until NetInfo supplies the real device state. Assuming
// online here can launch remote work during an offline cold start.
let isOnline = false;
let listeners: (() => void)[] = [];

export function initializeNetworkListener() {
    NetInfo.addEventListener((state) => {
        isOnline = !!state.isConnected;

        listeners.forEach((l) => l());
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
