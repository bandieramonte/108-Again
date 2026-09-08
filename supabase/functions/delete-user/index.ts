import { withSupabase } from "@supabase/server";

// @ts-ignore
import "@supabase/functions-js/edge-runtime.d.ts";

export default {
  fetch: withSupabase(
    { auth: "user", errors: { detailed: false } },
    async (_req, { supabaseAdmin, userClaims }) => {
      const userId = userClaims?.id;

      if (!userId) {
        return Response.json({ error: "Invalid JWT" }, { status: 401 });
      }

      try {
        const imageBucket = supabaseAdmin.storage.from("practice-images");
        const { data: practiceImages, error: listImageError } =
          await imageBucket.list(userId, { limit: 100 });

        if (listImageError) {
          throw listImageError;
        }

        if (practiceImages?.length) {
          const { error: removeImageError } = await imageBucket.remove(
            practiceImages.map(
              (image: { name: string }) => `${userId}/${image.name}`
            )
          );

          if (removeImageError) {
            throw removeImageError;
          }
        }

        await supabaseAdmin.from("sessions").delete().eq("user_id", userId);
        await supabaseAdmin.from("practices").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) {
          throw error;
        }

        return Response.json({ success: true });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }
  ),
};
