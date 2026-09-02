import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Settings2, Sparkles, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { getMember } from "@/data/team";
import { starterPrompts, integrationStatusLabel } from "@/data/app";
import { useIntegrations, useMessages, useWorkspace } from "@/lib/data";
import { askEmployee, runSkill } from "@/lib/ai.functions";
import { SkillRunner } from "@/components/app/SkillRunner";
import { PublishToWordPress } from "@/components/app/PublishToWordPress";

import { skillsFor, type Skill } from "@/data/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/chat/$id")({
  loader: ({ params }) => {
    const member = getMember(params.id);
    if (!member) throw notFound();
    return { name: member.name, role: member.role };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `محادثة ${loaderData.name} | سهل` : "محادثة | سهل" },
      {
        name: "description",
        content: loaderData ? `تحدث مع ${loaderData.name} — ${loaderData.role}.` : "محادثة الموظف.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => <ChatMissing />,
  notFoundComponent: () => <ChatMissing />,
  component: ChatPage,
});

function ChatMissing() {
  return (
    <AppShell title="الموظف غير موجود">
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <p className="text-ink-soft">لم نعثر على هذا الموظف ضمن فريقك.</p>
        <Link
          to="/app/chat"
          className="mt-5 inline-block rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background"
        >
          العودة للمحادثات
        </Link>
      </div>
    </AppShell>
  );
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

function ChatPage() {
  const { id } = Route.useParams();
  const member = getMember(id)!;
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();
  const { data: messages } = useMessages(workspace?.id, id);
  const { data: integrations } = useIntegrations(workspace?.id);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const ask = useServerFn(askEmployee);
  const runSkillFn = useServerFn(runSkill);
  const employeeSkills = skillsFor(id);

  const owned = (integrations ?? []).filter((i) => i.employee_id === id);
  const wpConnected = (integrations ?? []).some(
    (i) => i.provider === "wordpress" && i.status === "connected",
  );


  const send = useMutation({
    mutationFn: (message: string) =>
      ask({ data: { workspaceId: workspace!.id, employeeId: id, message } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages", workspace?.id, id] });
      void qc.invalidateQueries({ queryKey: ["messages-last", workspace?.id] });
      void qc.invalidateQueries({ queryKey: ["tasks", workspace?.id] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر إرسال الطلب"),
  });

  const skillRun = useMutation({
    mutationFn: (p: { skill: Skill; values: Record<string, string> }) =>
      runSkillFn({
        data: {
          workspaceId: workspace!.id,
          employeeId: id,
          skillId: p.skill.id,
          values: p.values,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages", workspace?.id, id] });
      void qc.invalidateQueries({ queryKey: ["messages-last", workspace?.id] });
      void qc.invalidateQueries({ queryKey: ["tasks", workspace?.id] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر تنفيذ المهمة"),
  });

  const busy = send.isPending || skillRun.isPending;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, send.isPending, skillRun.isPending]);

  const submit = (text: string) => {
    const body = text.trim();
    if (!body || !workspace || busy) return;
    setError(null);
    setDraft("");
    send.mutate(body);
  };

  return (
    <AppShell
      title={member.name}
      lead={member.role}
      padded={false}
      actions={
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={cn(
            "grid size-10 place-items-center rounded-xl border border-border transition-colors",
            showSettings ? "bg-foreground text-background" : "hover:bg-secondary",
          )}
          aria-label="إعدادات الموظف"
        >
          <Settings2 className="size-4.5" />
        </button>
      }
    >
      <div className="grid lg:grid-cols-[1fr_20rem]">
        <div className="flex min-h-[calc(100vh-5.5rem)] flex-col">
          <div className="flex-1 space-y-4 px-5 py-6">
            {(messages ?? []).length === 0 ? (
              <div className="rounded-3xl border border-border bg-card p-8 text-center">
                <span
                  className="mx-auto grid size-12 place-items-center rounded-2xl"
                  style={{ background: member.tintSoft, color: member.tint }}
                >
                  <member.icon className="size-6" strokeWidth={2.2} />
                </span>
                <p className="mt-4 font-bold">{member.tagline}</p>
                <p className="mt-1 text-sm text-ink-soft">اكتب طلبك بالأسفل وسأبدأ فوراً.</p>
              </div>
            ) : null}

            {(messages ?? []).map((m) => (
              <div
                key={m.id}
                className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role !== "user" ? (
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-xl"
                    style={{ background: member.tintSoft, color: member.tint }}
                  >
                    <member.icon className="size-4.5" strokeWidth={2.2} />
                  </span>
                ) : null}
                <div
                  className={cn(
                    "max-w-[38rem] rounded-3xl px-5 py-3.5 leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-foreground text-background"
                      : "border border-border bg-card",
                  )}
                >
                  <p>{m.body}</p>
                  {m.role !== "user" && id === "nour" && workspace && wpConnected && m.body.length > 200 ? (
                    <PublishToWordPress workspaceId={workspace.id} body={m.body} />
                  ) : null}
                  <p
                    className={cn(
                      "mt-1.5 text-[0.7rem]",
                      m.role === "user" ? "text-background/60" : "text-muted-foreground",
                    )}
                  >
                    {timeOf(m.created_at)}
                  </p>

                </div>
              </div>
            ))}

            {busy ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: member.tintSoft, color: member.tint }}
                >
                  <member.icon className="size-4.5" strokeWidth={2.2} />
                </span>
                <Loader2 className="size-4 animate-spin" /> {member.name} يعمل على طلبك…
              </div>
            ) : null}

            {error ? (
              <p className="rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
                {error}
              </p>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="sticky bottom-0 border-t border-border bg-background/90 p-5 backdrop-blur-xl">
            <SkillRunner
              skills={employeeSkills}
              disabled={!workspace}
              pending={busy}
              onRun={(skill, values) => {
                setError(null);
                skillRun.mutate({ skill, values });
              }}
            />
            <div className="mb-3 flex flex-wrap gap-2">
              {(starterPrompts[id] ?? []).map((p) => (
                <button
                  key={p}
                  onClick={() => submit(p)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  <Sparkles className="size-3.5 text-jade" />
                  {p}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(draft);
              }}
              className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`اكتب طلبك لـ${member.name}…`}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
              />
              <button
                type="submit"
                disabled={busy || !workspace}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground text-background disabled:opacity-50"
                aria-label="إرسال"
              >
                {busy ? (
                  <Loader2 className="size-4.5 animate-spin" />
                ) : (
                  <Send className="size-4.5 -scale-x-100" />
                )}
              </button>
            </form>
          </div>
        </div>

        <aside
          className={cn(
            "border-s border-border bg-card p-5",
            showSettings ? "block" : "hidden lg:block",
          )}
        >
          <h2 className="font-display font-black">حسابات {member.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">حساب واحد لكل منصة داخل مساحة العمل.</p>
          <ul className="mt-4 space-y-2">
            {owned.map((i) => (
              <li
                key={i.id}
                className="flex items-center gap-3 rounded-2xl border border-border/70 p-3"
              >
                <AppIcon name={i.provider} className="size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{appLabel(i.provider)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {i.account ?? "لم يُربط بعد"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold",
                    i.status === "connected" && "bg-jade/12 text-jade-deep",
                    i.status === "error" && "bg-coral/15 text-coral",
                    i.status === "disconnected" && "bg-secondary text-muted-foreground",
                  )}
                >
                  {integrationStatusLabel[i.status as keyof typeof integrationStatusLabel] ??
                    i.status}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="mt-7 font-display font-black">ما يجيده</h2>
          <ul className="mt-3 space-y-2">
            {member.tasks.slice(0, 4).map((t) => (
              <li key={t} className="flex gap-2 text-sm text-ink-soft">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-jade" />
                {t}
              </li>
            ))}
          </ul>

          <Link
            to="/app/brain"
            className="mt-7 block rounded-2xl bg-secondary/60 p-4 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            يقرأ من عقل العلامة — أضف مستندات ليصبح أدق ↖
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
