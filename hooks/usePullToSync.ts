import { useCallback, useEffect, useRef, useState } from "react";
import * as authService from "../services/authService";
import { getIsOnline } from "../services/networkService";
import {
    pullToSync,
    type PullToSyncResult,
} from "../services/pullToSyncService";
import * as syncService from "../services/syncService";

export type PullToSyncStatus = PullToSyncResult | "syncing";

const RESULT_VISIBLE_MS = 1600;

export function usePullToSync(enabled = true) {
    const [status, setStatus] = useState<PullToSyncStatus | null>(null);
    const inFlightRef = useRef(false);
    const mountedRef = useRef(true);
    const clearStatusTimerRef =
        useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearStatusTimer = useCallback(() => {
        if (!clearStatusTimerRef.current) return;

        clearTimeout(clearStatusTimerRef.current);
        clearStatusTimerRef.current = null;
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
            clearStatusTimer();
        };
    }, [clearStatusTimer]);

    const onRefresh = useCallback(async () => {
        if (!enabled || inFlightRef.current) return;

        inFlightRef.current = true;
        clearStatusTimer();
        setStatus("syncing");

        const result = await pullToSync(
            authService.getCurrentUserId(),
            {
                getIsOnline,
                onError: error => {
                    console.warn("Pull-to-sync failed", error);
                },
                syncNow: userId => syncService.syncNow(userId),
            }
        );

        inFlightRef.current = false;
        if (!mountedRef.current) return;

        setStatus(result);
        clearStatusTimerRef.current = setTimeout(() => {
            clearStatusTimerRef.current = null;
            setStatus(null);
        }, RESULT_VISIBLE_MS);
    }, [clearStatusTimer, enabled]);

    return {
        onRefresh,
        refreshing: status === "syncing",
        status,
    };
}
