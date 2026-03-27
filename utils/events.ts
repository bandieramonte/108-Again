type Callback = () => void;

let dataListeners: Callback[] = [];
let authListeners: Callback[] = [];
let syncListeners: Callback[] = [];

function removeListener(list: Callback[], cb: Callback) {
    return list.filter(listener => listener !== cb);
}

function notify(list: Callback[]) {
    list.forEach(cb => cb());
}

export function subscribeData(cb: Callback) {
    dataListeners.push(cb);

    return () => {
        dataListeners = removeListener(dataListeners, cb);
    };
}

export function subscribeAuth(cb: Callback) {
    authListeners.push(cb);

    return () => {
        authListeners = removeListener(authListeners, cb);
    };
}

export function subscribeSync(cb: Callback) {
    syncListeners.push(cb);

    return () => {
        syncListeners = removeListener(syncListeners, cb);
    };
}

export function emitDataChanged() {
    notify(dataListeners);
}

export function emitAuthChanged() {
    notify(authListeners);
}

export function emitSyncChanged() {
    notify(syncListeners);
}