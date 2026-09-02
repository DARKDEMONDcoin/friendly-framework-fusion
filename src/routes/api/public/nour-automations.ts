import { createFileRoute } from "@tanstack/react-router";

/**
 * مشغّل الجدولة التلقائية لنور: يقرأ الجدولات المستحقة وينفّذها بنفس نواة التنفيذ اليدوية،
 * ثم يحسب الموعد القادم، ويرسل المخرج مسودةً للمنصة المربوطة إن كان النشر التلقائي مفعّلاً.
 * محمي بترويسة x-cron-secret (LOVABLE_CRON_SECRET أو الرمز الداخلي في private.cron_tokens).
 */
export const Route = createFileRoute("/api/public/nour-automations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!provided) return new Response("unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const envSecret = process.env["LOVABLE_CRON_SECRET"];
        let authorized = Boolean(envSecret) && provided === envSecret;
        if (!authorized) {
          const { data: valid } = await supabaseAdmin.rpc("verify_cron_token", {
            _name: "nour-weekly",
            _token: provided,
          });
          authorized = valid === true;
        }
        if (!authorized) return new Response("unauthorized", { status: 401 });

        const now = new Date();
        const { data: due, error } = await supabaseAdmin
          .from("automations")
          .select("*")
          .eq("active", true)
          .lte("next_run_at", now.toISOString())
          .limit(20);
        if (error) return new Response(error.message, { status: 500 });

        const { executeSkill } = await import("@/lib/nour-run.server");
        const { nextRun } = await import("@/lib/automations.functions");

        const report: { id: string; label: string; status: string; taskId?: string | null }[] = [];

        for (const row of due ?? []) {
          try {
            const run = await executeSkill(supabaseAdmin, {
              workspaceId: row.workspace_id,
              employeeId: row.employee_id,
              skillId: row.skill_id,
              values: (row.values as Record<string, string> | null) ?? {},
              origin: "جدولة تلقائية",
            });

            let published: string | null = null;
            if (row.auto_publish) {
              const { toArticle } = await import("@/lib/markdown");
              const { autoPublish } = await import("@/lib/publish-core.server");
              const article = toArticle(run.output);
              const result = await autoPublish(
                supabaseAdmin,
                row.workspace_id,
                article,
                "draft",
              );
              published = result ? `${result.provider}${result.link ? ` · ${result.link}` : ""}` : null;
            }

            await supabaseAdmin
              .from("automations")
              .update({
                last_run_at: now.toISOString(),
                last_status: published ? `نجح · مسودة على ${published}` : "نجح",
                next_run_at: nextRun(
                  row.cadence as "daily" | "weekly" | "monthly",
                  row.day_of_week,
                  row.hour,
                  now,
                ).toISOString(),
              })
              .eq("id", row.id);

            report.push({ id: row.id, label: row.label, status: "ok", taskId: run.taskId });
          } catch (e) {
            const message = e instanceof Error ? e.message : "فشل غير معروف";
            await supabaseAdmin
              .from("automations")
              .update({
                last_run_at: now.toISOString(),
                last_status: `فشل: ${message.slice(0, 200)}`,
                next_run_at: nextRun(
                  row.cadence as "daily" | "weekly" | "monthly",
                  row.day_of_week,
                  row.hour,
                  now,
                ).toISOString(),
              })
              .eq("id", row.id);
            report.push({ id: row.id, label: row.label, status: message });
          }
        }

        return Response.json({ ran: report.length, report });
      },
    },
  },
});
