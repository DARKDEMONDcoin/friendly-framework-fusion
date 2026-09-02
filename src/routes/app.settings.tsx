import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, Building2, Bell, User } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import {
  useProfile,
  useTasks,
  useUpdateProfile,
  useUpdateWorkspace,
  useWorkspace,
} from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات | سهل" },
      { name: "description", content: "مساحة العمل، حسابك، الاشتراك والتنبيهات." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const tabs = [
  { id: "workspace", label: "مساحة العمل", icon: Building2 },
  { id: "account", label: "حسابك", icon: User },
  { id: "billing", label: "الاشتراك", icon: CreditCard },
  { id: "notifications", label: "التنبيهات", icon: Bell },
] as const;

const field =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-jade";

function SettingsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("workspace");
  const { data: workspace } = useWorkspace();
  const { data: profile } = useProfile();
  const { data: tasks } = useTasks(workspace?.id);
  const updateWorkspace = useUpdateWorkspace();
  const updateProfile = useUpdateProfile();
  const [saved, setSaved] = useState<string | null>(null);

  const doneCount = (tasks ?? []).filter((t) => t.status === "done").length;

  return (
    <AppShell title="الإعدادات" lead="كل ما يخص مساحة عملك وحسابك.">
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors",
                tab === t.id ? "bg-foreground text-background" : "hover:bg-secondary",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </nav>

        <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
          {saved ? (
            <p className="mb-5 rounded-2xl bg-jade/12 px-4 py-3 text-sm font-semibold text-jade-deep">
              {saved}
            </p>
          ) : null}

          {tab === "workspace" && workspace ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await updateWorkspace.mutateAsync({
                  id: workspace.id,
                  patch: {
                    name: String(f.get("name")),
                    industry: String(f.get("industry")),
                    tone: String(f.get("tone")),
                    banned_words: String(f.get("banned"))
                      .split("،")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                });
                setSaved("تم حفظ إعدادات مساحة العمل.");
              }}
            >
              <h2 className="font-display text-xl font-black">مساحة العمل</h2>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">اسم النشاط</span>
                <input name="name" defaultValue={workspace.name} className={field} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">المجال</span>
                <input name="industry" defaultValue={workspace.industry} className={field} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">نبرة العلامة</span>
                <textarea
                  name="tone"
                  defaultValue={workspace.tone}
                  className={cn(field, "min-h-24 resize-none")}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">
                  كلمات ممنوعة (افصل بينها بفاصلة عربية)
                </span>
                <input
                  name="banned"
                  defaultValue={workspace.banned_words.join("، ")}
                  className={field}
                />
              </label>
              <button
                type="submit"
                disabled={updateWorkspace.isPending}
                className="rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background disabled:opacity-60"
              >
                {updateWorkspace.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
              </button>
            </form>
          ) : null}

          {tab === "account" && profile ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await updateProfile.mutateAsync({
                  id: profile.id,
                  patch: {
                    full_name: String(f.get("full_name")),
                    dialect: String(f.get("dialect")),
                  },
                });
                setSaved("تم تحديث حسابك.");
              }}
            >
              <h2 className="font-display text-xl font-black">حسابك</h2>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">الاسم</span>
                <input name="full_name" defaultValue={profile.full_name ?? ""} className={field} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">لهجة المحتوى</span>
                <select name="dialect" defaultValue={profile.dialect} className={field}>
                  <option>خليجية</option>
                  <option>مصرية</option>
                  <option>شامية</option>
                  <option>مغاربية</option>
                  <option>فصحى معاصرة</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background disabled:opacity-60"
              >
                {updateProfile.isPending ? "جارٍ الحفظ…" : "حفظ"}
              </button>
            </form>
          ) : null}

          {tab === "billing" ? (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-black">الاشتراك</h2>
              <div className="rounded-2xl bg-secondary/50 p-5">
                <p className="font-bold">التجربة المجانية</p>
                <p className="mt-1 text-sm text-ink-soft">
                  استهلكت {doneCount} مهمة منجزة من أصل ٥٠ ضمن باقتك الحالية.
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-card">
                  <div
                    className="h-full rounded-full bg-jade"
                    style={{ width: `${Math.min(100, (doneCount / 50) * 100)}%` }}
                  />
                </div>
              </div>
              <Link
                to="/pricing"
                className="inline-block rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background"
              >
                عرض الباقات
              </Link>
            </div>
          ) : null}

          {tab === "notifications" ? (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-black">التنبيهات</h2>
              {["عند جاهزية عنصر للموافقة", "عند انقطاع ربط حساب", "ملخص أسبوعي بالبريد"].map(
                (label) => (
                  <label
                    key={label}
                    className="flex items-center justify-between rounded-2xl border border-border p-4"
                  >
                    <span className="text-sm font-semibold">{label}</span>
                    <input type="checkbox" defaultChecked className="size-5 accent-current" />
                  </label>
                ),
              )}
              <p className="text-sm text-muted-foreground">
                تُطبَّق التنبيهات على بريد حسابك الحالي.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
