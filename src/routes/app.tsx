import { createFileRoute, Outlet } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { guestSession } from "@/lib/guest.functions";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) return { user: data.user };

    // لا تسجيل: نفتح جلسة تجربة تلقائياً
    const { tokenHash } = await guestSession();
    const { data: verified, error } = await supabase.auth.verifyOtp({
      type: "email",
      token_hash: tokenHash,
    });
    if (error || !verified.user) throw new Error(error?.message ?? "تعذّر فتح جلسة التجربة");
    return { user: verified.user };
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: () => <Outlet />,
});
