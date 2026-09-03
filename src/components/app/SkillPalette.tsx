import { useMemo, useState } from "react";
import { Loader2, Search, Sparkles, Wand2, X } from "lucide-react";

import type { Skill, SkillCategory } from "@/data/skills";
import { cn } from "@/lib/utils";

type Props = {
  skills: Skill[];
  disabled?: boolean;
  pending?: boolean;
  onRun: (skill: Skill, values: Record<string, string>) => void;
};

function initialValues(skill: Skill) {
  return Object.fromEntries(skill.fields.map((f) => [f.name, f.defaultValue ?? ""]));
}

/**
 * لوحة قدرات احترافية: زر واحد يفتح مُستعرضاً قابلاً للبحث ومجمّعاً بالتصنيفات،
 * ثم نموذج تنفيذ القدرة — بدل صف طويل من الأزرار فوق مربع الإدخال.
 */
export function SkillPalette({ skills, disabled, pending, onRun }: Props) {
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Skill | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const groups = useMemo(() => {
    const q = query.trim();
    const list = q
      ? skills.filter((s) => `${s.title} ${s.summary} ${s.category}`.includes(q))
      : skills;
    const map = new Map<SkillCategory, Skill[]>();
    for (const s of list) map.set(s.category, [...(map.get(s.category) ?? []), s]);
    return [...map.entries()];
  }, [skills, query]);

  if (skills.length === 0) return null;

  const start = (skill: Skill) => {
    setValues(initialValues(skill));
    setOpen(skill);
    setBrowsing(false);
  };

  const ready =
    open?.fields.every((f) => !f.required || (values[f.name] ?? "").trim().length > 0) ?? false;

  return (
    <>
      <button
        type="button"
        onClick={() => setBrowsing(true)}
        disabled={disabled || pending}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <Sparkles className="size-3.5 text-primary" />
        القدرات
        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
          {skills.length}
        </span>
      </button>

      {browsing ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
          onClick={() => setBrowsing(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-lift sm:rounded-3xl"
          >
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في القدرات…"
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setBrowsing(false)}
                className="grid size-9 shrink-0 place-items-center rounded-xl border border-border hover:bg-secondary"
                aria-label="إغلاق"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {groups.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">لا نتائج مطابقة.</p>
              ) : null}
              {groups.map(([category, list]) => (
                <section key={category} className="mb-5">
                  <h3 className="mb-2 text-xs font-black text-muted-foreground">{category}</h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {list.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => start(s)}
                          className="w-full rounded-2xl border border-border p-3 text-start transition-colors hover:border-primary hover:bg-secondary/60"
                        >
                          <span className="block text-sm font-bold">{s.title}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            {s.summary}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-lift">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-xl font-black">{open.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{open.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="grid size-9 shrink-0 place-items-center rounded-xl border border-border hover:bg-secondary"
                aria-label="إغلاق"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!ready) return;
                onRun(open, values);
                setOpen(null);
              }}
            >
              {open.fields.map((f) => {
                const id = `skill-${open.id}-${f.name}`;
                const val = values[f.name] ?? "";
                const set = (v: string) => setValues((p) => ({ ...p, [f.name]: v }));
                return (
                  <div key={f.name}>
                    <label htmlFor={id} className="block text-sm font-bold">
                      {f.label}
                      {f.required ? <span className="text-primary"> *</span> : null}
                    </label>
                    {f.help ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.help}</p>
                    ) : null}
                    {f.type === "textarea" ? (
                      <textarea
                        id={id}
                        rows={5}
                        value={val}
                        placeholder={f.placeholder}
                        onChange={(e) => set(e.target.value)}
                        className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
                      />
                    ) : f.type === "select" ? (
                      <select
                        id={id}
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
                      >
                        {(f.options ?? []).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={id}
                        type={f.type === "number" ? "number" : "text"}
                        value={val}
                        placeholder={f.placeholder}
                        onChange={(e) => set(e.target.value)}
                        className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
                      />
                    )}
                  </div>
                );
              })}

              <button
                type="submit"
                disabled={!ready || pending}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 font-bold text-background transition-opacity",
                  (!ready || pending) && "opacity-50",
                )}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                نفّذ المهمة
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
