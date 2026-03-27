import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// @ts-ignore
import "@supabase/functions-js/edge-runtime.d.ts";

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Missing auth", { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  // ✅ 1. CLIENT WITH ANON KEY (for auth)
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser(token);

  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid JWT" }),
      { status: 401 }
    );
  }

  const userId = user.id;

  // ✅ 2. ADMIN CLIENT (for deletion)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // delete user data
  await supabaseAdmin.from("sessions").delete().eq("user_id", userId);
  await supabaseAdmin.from("practices").delete().eq("user_id", userId);
  await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

  // delete auth user
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
  });
});