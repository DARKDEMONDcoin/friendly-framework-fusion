import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCircle2, Loader2, Clock4, Plus, Settings2 } from "lucide-react";

import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/Reveal";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { workFeed, kpis, statusLabel, type WorkItem } from "@/data/work";
import { team } from "@/data/team";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | أعمال فريقك اليوم — سهل" },
      {
        name: "description",
        content: "تابع مهام موظفيك الرقميين، اعتمد ما ينتظر موافقتك، وراقب المؤشرات الأسبوعية.",
      },
      { property: "og:title", content: "لوحة تحكم سهل" },
      { property: "og:description", content: "كل ما أنجزه فريقك الرقمي في شاشة واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

const statusStyle: Record<WorkItem["status"], string> = {
  done: "bg-jade/12 text-jade-deep",
  running: "bg-amber/15 text-amber",
  review: "bg-primary/10 text-primary",
};

const statusIcon = {
  done: CheckCircle2,
  running: Loader2,
  review: Clock4,
} as const;

function DashboardPage() {
  const pending = workFeed.filter((w) => w.status === "review");

  return (
    <div className="min-h-screen bg-background">
      <Nav variant="solid" />
      <main className="mx-auto max-w-6xl px-5 pt-28 pb-16">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">صباح الخير 👋</p>
              <h1 className="mt-1 font-display text-3xl font-black md:text-4xl">
                فريقك أنجز {workFeed.filter((w) => w.status === "done").length} مهام منذ أمس
              </h1>
              <p className="mt-2 text-ink-soft">
                {pending.length} عناصر تنتظر موافقتك — تستغرق أقل من ٣ دقائق.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:bg-secondary">
                <Bell className="size-4" /> التنبيهات
              </button>
              <button className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background">
                <Plus className="size-4" /> مهمة جديدة
              </button>
            </div>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <Reveal key={k.k} delay={i * 50}>
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="font-display text-3xl font-black text-primary">{k.v}</div>
                <div className="mt-1 font-semibold">{k.k}</div>
                <div className="mt-1 text-sm text-muted-foreground">{k.d}</div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Reveal>
            <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-black">سجل العمل المباشر</h2>
                <span className="text-sm text-muted-foreground">آخر ٢٤ ساعة</span>
              </div>
              <ul className="mt-5 space-y-3">
                {workFeed.map((w) => {
                  const member = team.find((t) => t.id === w.employee);
                  const Icon = statusIcon[w.status];
                  return (
                    <li
                      key={w.id}
                      className="rounded-2xl border border-border/70 p-5 transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        {member ? (
                          <Link
                            to="/employees/$id"
                            params={{ id: member.id }}
                            className="inline-flex items-center gap-2 text-sm font-bold"
                          >
                            <span
                              className="grid size-8 place-items-center rounded-xl"
                              style={{ background: member.tintSoft, color: member.tint }}
                            >
                              <member.icon className="size-4" strokeWidth={2.2} />
                            </span>
                            {member.name}
                          </Link>
                        ) : null}
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusStyle[w.status]}`}
                        >
                          <Icon className={`size-3.5 ${w.status === "running" ? "animate-spin" : ""}`} />
                          {statusLabel[w.status]}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <AppIcon name={w.channel} className="size-4" />
                          {appLabel(w.channel)}
                        </span>
                        <span className="ms-auto text-xs text-muted-foreground">{w.time}</span>
                      </div>
                      <h3 className="mt-3 font-display font-bold">{w.title}</h3>
                      <p className="mt-1 leading-relaxed text-ink-soft">{w.detail}</p>
                      {w.status === "review" ? (
                        <div className="mt-4 flex gap-2">
                          <button className="rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background">
                            اعتماد
                          </button>
                          <button className="rounded-full border border-border px-5 py-2 text-sm font-bold transition-colors hover:bg-secondary">
                            طلب تعديل
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          </Reveal>

          <div className="space-y-6">
            <Reveal delay={60}>
              <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
                <h2 className="font-display text-xl font-black">فريقك</h2>
                <ul className="mt-5 space-y-3">
                  {team.map((m) => (
                    <li key={m.id}>
                      <Link
                        to="/employees/$id"
                        params={{ id: m.id }}
                        className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-secondary/50"
                      >
                        <span
                          className="grid size-10 place-items-center rounded-2xl"
                          style={{ background: m.tintSoft, color: m.tint }}
                        >
                          <m.icon className="size-5" strokeWidth={2.2} />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold">{m.name}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {m.role}
                          </span>
                        </span>
                        <span className="ms-auto size-2.5 shrink-0 rounded-full bg-jade" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>

            <Reveal delay={120}>
              <section className="rounded-3xl border border-border bg-secondary/50 p-7">
                <span className="grid size-11 place-items-center rounded-2xl bg-card text-primary shadow-card">
                  <Settings2 className="size-5" />
                </span>
                <h2 className="mt-4 font-display text-lg font-black">أكمل إعداد علامتك</h2>
                <p className="mt-2 leading-relaxed text-ink-soft">
                  أضف ١٠ نصوص تفتخر بها وقائمة الكلمات الممنوعة، ترتفع دقة النبرة بنسبة ٤٠٪.
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-card">
                  <div
                    className="h-full rounded-full"
                    style={{ width: "65%", backgroundImage: "var(--gradient-aurora)" }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">اكتمل ٦٥٪</p>
              </section>
            </Reveal>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
