import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { team } from "@/data/team";
import { useLastMessages, useWorkspace } from "@/lib/data";

export const Route = createFileRoute("/app/chat/")({
  head: () => ({
    meta: [
      { title: "المحادثات | سهل" },
      { name: "description", content: "تحدث مع أي موظف من فريقك الرقمي." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatIndex,
});

function ChatIndex() {
  const { data: workspace } = useWorkspace();
  const { data: messages } = useLastMessages(workspace?.id);

  return (
    <AppShell title="المحادثات" lead="اطلب من أي موظف ما تحتاجه — بالعربية وبلهجتك.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {team.map((m) => {
          const last = (messages ?? []).find((x) => x.employee_id === m.id);
          return (
            <Link
              key={m.id}
              to="/app/chat/$id"
              params={{ id: m.id }}
              className="group rounded-3xl border border-border bg-card p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid size-12 place-items-center rounded-2xl"
                  style={{ background: m.tintSoft, color: m.tint }}
                >
                  <m.icon className="size-6" strokeWidth={2.2} />
                </span>
                <span>
                  <span className="block font-display font-black">{m.name}</span>
                  <span className="block text-sm text-muted-foreground">{m.role}</span>
                </span>
              </div>
              <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                {last?.body ?? m.tagline}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                افتح المحادثة
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
