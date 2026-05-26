import type { SupabaseClient } from "@supabase/supabase-js";
import type {
    RemotePracticeRow,
    RemoteSessionRow,
    SyncRemote,
} from "./syncEngine";

type RunRemoteQuery = <T>(queryFactory: () => PromiseLike<T>) => Promise<T>;

async function runDirect<T>(queryFactory: () => PromiseLike<T>) {
    return queryFactory();
}

export function createSupabaseSyncRemote(
    client: SupabaseClient,
    runRemoteQuery: RunRemoteQuery = runDirect
): SyncRemote {
    return {
        async pullPractices(userId: string) {
            const { data, error } = await runRemoteQuery(async () => client
                .from("practices")
                .select(`
                    id,
                    user_id,
                    name,
                    target_count,
                    order_index,
                    image_key,
                    default_add_count,
                    total_offset,
                    updated_at,
                    deleted_at
                `)
                .eq("user_id", userId)
                .order("order_index", { ascending: true }));

            if (error) throw error;

            return (data ?? []) as RemotePracticeRow[];
        },

        async pullSessions(userId: string) {
            const { data, error } = await runRemoteQuery(async () => client
                .from("sessions")
                .select(`
                    id,
                    user_id,
                    practice_id,
                    count,
                    created_at,
                    updated_at,
                    deleted_at
                `)
                .eq("user_id", userId)
                .order("created_at", { ascending: true }));

            if (error) throw error;

            return (data ?? []) as RemoteSessionRow[];
        },

        async getPracticesById(userId: string, ids: string[]) {
            if (ids.length === 0) return new Map<string, RemotePracticeRow>();

            const { data, error } = await runRemoteQuery(async () => client
                .from("practices")
                .select(`
                    id,
                    user_id,
                    name,
                    target_count,
                    order_index,
                    image_key,
                    default_add_count,
                    total_offset,
                    updated_at,
                    deleted_at
                `)
                .eq("user_id", userId)
                .in("id", ids));

            if (error) throw error;

            return new Map(
                (data ?? []).map((row) => [
                    row.id as string,
                    row as RemotePracticeRow,
                ])
            );
        },

        async getSessionsById(userId: string, ids: string[]) {
            if (ids.length === 0) return new Map<string, RemoteSessionRow>();

            const { data, error } = await runRemoteQuery(async () => client
                .from("sessions")
                .select(`
                    id,
                    user_id,
                    practice_id,
                    count,
                    created_at,
                    updated_at,
                    deleted_at
                `)
                .eq("user_id", userId)
                .in("id", ids));

            if (error) throw error;

            return new Map(
                (data ?? []).map((row) => [
                    row.id as string,
                    row as RemoteSessionRow,
                ])
            );
        },

        async upsertPractices(rows: RemotePracticeRow[]) {
            if (rows.length === 0) return;

            const { error } = await runRemoteQuery(async () => client
                .from("practices")
                .upsert(rows, { onConflict: "id,user_id" }));

            if (error) throw error;
        },

        async upsertSessions(rows: RemoteSessionRow[]) {
            if (rows.length === 0) return;

            const { error } = await runRemoteQuery(async () => client
                .from("sessions")
                .upsert(rows, { onConflict: "id" }));

            if (error) throw error;
        },

        async softDeleteUserData(userId: string, deletedAt: number) {
            const deletedAtIso = new Date(deletedAt).toISOString();

            const { error: sessionError } = await runRemoteQuery(async () =>
                client
                    .from("sessions")
                    .update({
                        updated_at: deletedAtIso,
                        deleted_at: deletedAtIso,
                    })
                    .eq("user_id", userId)
                    .select()
            );

            if (sessionError) throw sessionError;

            const { error: practiceError } = await runRemoteQuery(async () =>
                client
                    .from("practices")
                    .update({
                        updated_at: deletedAtIso,
                        deleted_at: deletedAtIso,
                    })
                    .eq("user_id", userId)
                    .select()
            );

            if (practiceError) throw practiceError;
        },
    };
}
