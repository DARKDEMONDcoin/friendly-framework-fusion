import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, RefreshCw, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { WordPressConnect } from "@/components/app/WordPressConnect";
import { SearchConsoleSites } from "@/components/app/SearchConsoleSites";
import { team } from "@/data/team";
import { integrationStatusLabel } from "@/data/app";
import { useIntegrations, useSetIntegrationStatus, useWorkspace } from "@/lib/data";
import { disconnectProvider } from "@/lib/integrations.functions";
import { startSearchConsoleOAuth } from "@/lib/gsc.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/integrations")({
  head: () => ({
    meta: [
      { title: "التكاملات | سهل" },
      { name: "description", content: "اربط حسابات علامتك ليعمل فريقك مباشرة عليها." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntegrationsPage,
});

/** المنصات المربوطة ربطاً حقيقياً (لا محاكاة). */
const realProviders = new Set(["wordpress", "search-console"]);

const gscMessages: Record<string, string> = {
  denied: "أُلغيت موافقة Google — لم يتم الربط.",
  token_failed: "تعذّر إكمال الربط مع Google، جرّب مرة أخرى.",
  no_refresh_token: "لم يمنحنا Google صلاحية دائمة — أعد المحاولة واقبل الصلاحيات.",
  store_failed: "تعذّر حفظ بيانات الربط.",
  failed: "تعذّر إكمال الربط.",
};

function IntegrationsPage() {
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();
  const { data: integrations, isLoading } = useIntegrations(workspace?.id);
  const setStatus = useSetIntegrationStatus(workspace?.id);
  const disconnect = useServerFn(disconnectProvider);
  const startGsc = useServerFn(startSearchConsoleOAuth);
  const [busy, setBusy] = useState<string | null>(null);
  const [wpOpen, setWpOpen] = useState(false);
  const [gscOpen, setGscOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("gsc");
    if (!status) return;
    if (status === "connected") setGscOpen(true);
    else setError(gscMessages[status] ?? "تعذّر إكمال ربط Search Console.");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const all = integrations ?? [];
  const connected = all.filter((i) => i.status === "connected").length;
  const broken = all.filter((i) => i.status === "error");

  const toggle = async (id: string, status: string, provider: string) => {
    setError(null);
    if (realProviders.has(provider)) {
      if (status !== "connected") {
        if (provider === "wordpress") {
          setWpOpen(true);
          return;
        }
        setBusy(id);
        try {
          const { url } = await startGsc({ data: { workspaceId: workspace!.id } });
          window.location.href = url;
        } catch (e) {
          setError(e instanceof Error ? e.message : "تعذّر بدء الربط مع Google");
          setBusy(null);
        }
        return;
      }
      setBusy(id);
      try {
        await disconnect({ data: { workspaceId: workspace!.id, provider } });
        void qc.invalidateQueries({ queryKey: ["integrations", workspace?.id] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر فصل الحساب");
      } finally {
        setBusy(null);
      }
      return;
    }

    setBusy(id);
    try {
      if (status === "connected") {
        await setStatus.mutateAsync({ id, status: "disconnected", account: null });
      } else {
        await setStatus.mutateAsync({
          id,
          status: "connected",
          account: `${workspace?.name ?? "حسابي"} · ${appLabel(provider)}`,
        });
      }
    } finally {
      setBusy(null);
    }
  };



  return (
    <AppShell
      title="التكاملات"
      lead={`${connected} حساباً مرتبطاً · حساب واحد لكل منصة داخل مساحة العمل`}
    >
      {wpOpen && workspace ? (
        <WordPressConnect workspaceId={workspace.id} onClose={() => setWpOpen(false)} />
      ) : null}

      {gscOpen && workspace ? (
        <SearchConsoleSites workspaceId={workspace.id} onClose={() => setGscOpen(false)} />
      ) : null}


      {error ? (
        <p className="mb-6 rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
          {error}
        </p>
      ) : null}

      {broken.length ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-coral/30 bg-coral/8 p-4">
          <RefreshCw className="size-5 shrink-0 text-coral" />
          <p className="flex-1 text-sm font-semibold">
            {broken.length} حسابات تحتاج إعادة ربط — المهام المرتبطة بها متوقفة مؤقتاً.
          </p>
        </div>
      ) : null}


      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
        </p>
      ) : (
        <div className="space-y-6">
          {team.map((m) => {
            const owned = all.filter((i) => i.employee_id === m.id);
            if (!owned.length) return null;
            return (
              <section key={m.id} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-10 place-items-center rounded-2xl"
                    style={{ background: m.tintSoft, color: m.tint }}
                  >
                    <m.icon className="size-5" strokeWidth={2.2} />
                  </span>
                  <div>
                    <h2 className="font-display font-black">{m.name}</h2>
                    <p className="text-sm text-muted-foreground">{m.role}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {owned.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 p-4"
                    >
                      <AppIcon name={i.provider} className="size-6 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 truncate text-sm font-bold">
                          {appLabel(i.provider)}
                          {realProviders.has(i.provider) ? (
                            <span className="shrink-0 rounded-full bg-jade/12 px-2 py-0.5 text-[0.65rem] font-bold text-jade-deep">
                              ربط مباشر
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {i.account ?? "لم يُربط بعد"}
                        </span>
                      </span>

                      <button
                        onClick={() => void toggle(i.id, i.status, i.provider)}
                        disabled={busy === i.id}
                        className={cn(
                          "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-60",
                          i.status === "connected" && "bg-jade/12 text-jade-deep",
                          i.status === "error" && "bg-coral text-background",
                          i.status === "disconnected" && "bg-foreground text-background",
                        )}
                      >
                        {busy === i.id
                          ? "…"
                          : i.status === "connected"
                            ? integrationStatusLabel.connected
                            : i.status === "error"
                              ? "أعد الربط"
                              : "اربط"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-3xl border border-border bg-secondary/50 p-6">
        <ShieldCheck className="size-5 shrink-0 text-jade-deep" />
        <p className="text-sm leading-relaxed text-ink-soft">
          الربط يتم عبر OAuth الرسمي لكل منصة — لا نطلب كلمات مرورك أبداً، ويمكنك فصل أي حساب بضغطة
          واحدة.
        </p>
      </div>
    </AppShell>
  );
}
