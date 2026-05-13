import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

function requiredEnv(name: string, value: string | undefined): string {
    if (value == null || value === "") {
        throw new Error(`Missing ${name}`);
    }
    return value;
}

const supabaseUrl = requiredEnv(
    "EXPO_PUBLIC_SUPABASE_URL",
    process.env.EXPO_PUBLIC_SUPABASE_URL,
);
const supabaseKey = requiredEnv(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

function createSupabaseClient(): SupabaseClient {
    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false, // safer in RN
        },
    });
}

function timeout(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

let client: SupabaseClient = createSupabaseClient();
let clientMayBeStaleAfterBackground = false;

export function getSupabase() {
    return client;
}

export function markSupabaseClientStaleAfterBackground() {
    clientMayBeStaleAfterBackground = true;
}

export async function recreateSupabaseIfStaleAfterBackground() {
    if (!clientMayBeStaleAfterBackground) {
        return false;
    }

    await recreateSupabase();
    return true;
}

export async function recreateSupabase() {
    console.warn("Recreating Supabase client");

    const previousClient = client;
    client = createSupabaseClient();
    clientMayBeStaleAfterBackground = false;

    try {
        void Promise.race([
            Promise.resolve(previousClient.realtime.disconnect()),
            timeout(1000),
        ]).catch((e) => {
            console.warn(
                "Failed to disconnect previous realtime client",
                e
            );
        });
    } catch (e) {
        console.warn(
            "Failed to disconnect previous realtime client",
            e
        );
    }
}
