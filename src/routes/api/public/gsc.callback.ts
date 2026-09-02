import { createFileRoute } from "@tanstack/react-router";

import { decodeState, googleCreds, redirectUri, type SearchConsoleConfig } from "@/lib/gsc.functions";

export const Route = createFileRoute("/api/public/gsc/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const back = (msg: string) => Response.redirect(`${url.origin}/app/integrations?gsc=${msg}`, 302);

        if (url.searchParams.get("error") || !code || !state) return back("denied");

        try {
          const workspaceId = await decodeState(state);
          const { clientId, clientSecret } = googleCreds();

          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri(url.origin),
              grant_type: "authorization_code",
            }),
          });
          const tokenText = await tokenRes.text();
          if (!tokenRes.ok) {
            console.error(`[gsc] token exchange failed [${tokenRes.status}]: ${tokenText.slice(0, 300)}`);
            return back("token_failed");
          }
          const tokens = JSON.parse(tokenText) as { access_token: string; refresh_token?: string };
          if (!tokens.refresh_token) return back("no_refresh_token");

          let email: string | undefined;
          const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (meRes.ok) email = ((await meRes.json()) as { email?: string }).email;

          const config: SearchConsoleConfig = email
            ? { refreshToken: tokens.refresh_token, email }
            : { refreshToken: tokens.refresh_token };

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("integration_credentials").upsert(
            {
              workspace_id: workspaceId,
              provider: "search-console",
              config: config as unknown as Record<string, string>,
            },
            { onConflict: "workspace_id,provider" },
          );
          if (error) {
            console.error(`[gsc] store failed: ${error.message}`);
            return back("store_failed");
          }
          await supabaseAdmin
            .from("integrations")
            .update({ status: "connected", account: email ?? "حساب Google" })
            .eq("workspace_id", workspaceId)
            .eq("provider", "search-console");

          return back("connected");
        } catch (e) {
          console.error("[gsc] callback error", e);
          return back("failed");
        }
      },
    },
  },
});
