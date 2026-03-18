type Callback = () => void;

let listeners: Callback[] = [];

export function subscribe(cb: Callback) {
    listeners.push(cb);

    return () => {
        listeners = listeners.filter(listener => listener !== cb);
    };
}

export function emit() {
    listeners.forEach(cb => cb());
}