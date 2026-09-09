import { useCallback, useEffect, useRef, useState } from "react";
import * as authService from "../services/authService";
import { getIsOnline } from "../services/networkService";
import {
    pullToSync,
    type PullToSyncResult,
} from "../services/pullToSyncService";
import * as syncService from "../services/syncService";
import type { ProminentSyncStatus } from "../services/syncService";
import { subscribeSync } from "../utils/events";

export type PullToSyncStatus = PullToSyncResult | "syncing";

const RESULT_VISIBLE_MS = 1600;

export function usePullToSync(enabled = true) {
    const [status, setStatus] = useState<PullToSyncStatus | null>(null);
    const [prominentSyncStatus, setProminentSyncStatus] =
        useState<ProminentSyncStatus | null>(null);
    const inFlightRef = useRef(false);
    const mountedRef = useRef(true);
    const prominentSyncStatusRef = useRef<ProminentSyncStatus | null>(null);
    const clearStatusTimerRef =
        useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearProminentStatusTimerRef =
        useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearStatusTimer = useCallback(() => {
        if (!clearStatusTimerRef.current) return;

        clearTimeout(clearStatusTimerRef.current);
        clearStatusTimerRef.current = null;
    }, []);

    const clearProminentStatusTimer = useCallback(() => {
        if (!clearProminentStatusTimerRef.current) return;

        clearTimeout(clearProminentStatusTimerRef.current);
        clearProminentStatusTimerRef.current = null;
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
            clearStatusTimer();
            clearProminentStatusTimer();
        };
    }, [clearProminentStatusTimer, clearStatusTimer]);

    useEffect(() => {
        if (!enabled) {
            prominentSyncStatusRef.current = null;
            setProminentSyncStatus(null);
            clearProminentStatusTimer();
            return;
        }

        const updateProminentSyncStatus = () => {
            const next = syncService.getProminentSyncStatus();
            if (next === prominentSyncStatusRef.current) return;

            prominentSyncStatusRef.current = next;
            setProminentSyncStatus(next);
            clearProminentStatusTimer();

            if (next && next !== "retrieving_account_data") {
                clearProminentStatusTimerRef.current = setTimeout(() => {
                    clearProminentStatusTimerRef.current = null;
                    syncService.clearProminentSyncStatus();
                }, RESULT_VISIBLE_MS);
            }
        };

        updateProminentSyncStatus();
        return subscribeSync(updateProminentSyncStatus);
    }, [clearProminentStatusTimer, enabled]);

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
        prominentSyncStatus,
    };
}
