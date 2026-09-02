import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * تقرير سيو شهري قابل للطباعة: يجمع بيانات Search Console وGA4 الحقيقية
 * مع مهام نور المنفّذة، ويقدّم خلاصة مكتوبة بلا أي رقم مُختلق.
 */

export type ReportPayload = {
  workspace: { name: string; industry: string };
  range: { start: string; end: string } | null;
  search: {
    site: string;
    totals: { clicks: number; impressions: number; ctr: number; position: number };
    queries: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
    pages: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
  } | null;
  analytics: {
    property: string;
    totals: { sessions: number; users: number; engagedSessions: number };
    channels: { channel: string; sessions: number }[];
    organicLandingPages: { page: string; sessions: number }[];
  } | null;
  work: { published: number; awaiting: number; recent: { title: string; created_at: string }[] };
  opportunities: { query: string; reason: string }[];
  notes: string[];
};

export const buildReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), days: z.number().int().min(7).max(90).default(28) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ReportPayload> => {
    const { data: workspace, error: wsError } = await context.supabase
      .from("workspaces")
      .select("name, industry")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (wsError) throw new Error(wsError.message);
    if (!workspace) throw new Error("مساحة العمل غير موجودة.");

    const { gscSnapshotFor } = await import("./gsc.functions");
    const { ga4SnapshotFor } = await import("./ga4.functions");

    const [gsc, ga4, tasks] = await Promise.all([
      gscSnapshotFor(data.workspaceId, data.days),
      ga4SnapshotFor(data.workspaceId, data.days),
      context.supabase
        .from("tasks")
        .select("title, status, created_at")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const rows = tasks.data ?? [];
    const notes: string[] = [];
    if (!gsc) notes.push("Search Console غير مربوط — بيانات البحث غير متاحة في هذا التقرير.");
    if (!ga4) notes.push("Google Analytics 4 غير مربوط — بيانات الزيارات غير متاحة.");

    const totals = gsc
      ? gsc.queries.reduce(
          (acc, r) => ({
            clicks: acc.clicks + r.clicks,
            impressions: acc.impressions + r.impressions,
            ctr: 0,
            position: acc.position + r.position,
          }),
          { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        )
      : null;
    if (totals && gsc) {
      totals.ctr = totals.impressions ? totals.clicks / totals.impressions : 0;
      totals.position = gsc.queries.length ? totals.position / gsc.queries.length : 0;
    }

    // فرص حقيقية مبنية على أرقام Search Console فقط
    const opportunities = (gsc?.queries ?? [])
      .filter((r) => r.impressions >= 50 && r.position > 8 && r.position <= 20)
      .slice(0, 8)
      .map((r) => ({
        query: r.key,
        reason: `ظهور ${r.impressions} بمتوسط ترتيب ${r.position.toFixed(1)} — تحسين واحد قد ينقلها للصفحة الأولى.`,
      }));

    return {
      workspace: { name: workspace.name, industry: workspace.industry },
      range: gsc?.range ?? ga4?.range ?? null,
      search:
        gsc && totals
          ? { site: gsc.site, totals, queries: gsc.queries.slice(0, 15), pages: gsc.pages.slice(0, 15) }
          : null,
      analytics: ga4
        ? {
            property: ga4.property,
            totals: ga4.totals,
            channels: ga4.channels.slice(0, 8),
            organicLandingPages: ga4.organicLandingPages.slice(0, 10),
          }
        : null,
      work: {
        published: rows.filter((t) => t.status === "done").length,
        awaiting: rows.filter((t) => t.status === "review").length,
        recent: rows.slice(0, 10).map((t) => ({ title: t.title, created_at: t.created_at })),
      },
      opportunities,
      notes,
    };
  });
