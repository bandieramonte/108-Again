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

let client: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // safer in RN
    },
});

export function getSupabase() {
    return client;
}

export async function recreateSupabase() {
    console.warn("🔥 Recreating Supabase client");

    try {

        await client.realtime.disconnect();

    } catch (e) {

        console.warn(
            "Failed to disconnect realtime",
            e
        );
    }

    client = createClient(supabaseUrl, supabaseKey, {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    });
}