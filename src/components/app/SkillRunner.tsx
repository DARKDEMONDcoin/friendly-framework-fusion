import { useState } from "react";
import { Loader2, Wand2, X } from "lucide-react";

import type { Skill } from "@/data/skills";
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

export function SkillRunner({ skills, disabled, pending, onRun }: Props) {
  const [open, setOpen] = useState<Skill | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  if (skills.length === 0) return null;

  const start = (skill: Skill) => {
    setValues(initialValues(skill));
    setOpen(skill);
  };

  const ready =
    open?.fields.every((f) => !f.required || (values[f.name] ?? "").trim().length > 0) ?? false;

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {skills.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => start(s)}
            disabled={disabled || pending}
            title={s.summary}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <Wand2 className="size-3.5 text-primary" />
            {s.title}
          </button>
        ))}
      </div>

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
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                نفّذ المهمة
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
