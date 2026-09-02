import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { AuthShell, authInput } from "@/components/site/AuthShell";
import { signIn } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | لوحة تحكم فريقك الرقمي — سهل" },
      {
        name: "description",
        content: "ادخل إلى لوحة سهل لمتابعة مهام موظفيك الرقميين واعتماد الأعمال بانتظار موافقتك.",
      },
      { property: "og:title", content: "تسجيل الدخول — سهل" },
      { property: "og:description", content: "تابع فريقك الرقمي من مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthShell
      title="أهلاً بعودتك"
      lead="فريقك أنجز مهامّ بينما كنت بعيداً — لنرَ ما ينتظر موافقتك."
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link to="/signup" className="font-bold text-primary">
            أنشئ حساباً مجاناً
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          try {
            await signIn(String(form.get("email")), String(form.get("password")));
            void navigate({ to: "/app" });
          } catch (err) {
            setError(err instanceof Error ? err.message : "تعذّر تسجيل الدخول");
            setBusy(false);
          }
        }}
      >
        <div>
          <label className="mb-1.5 block text-sm font-bold" htmlFor="email">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={authInput}
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-bold" htmlFor="password">
            كلمة المرور
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className={authInput}
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <p className="rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-foreground py-3.5 font-bold text-background transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-60"
        >
          {busy ? "جارٍ الدخول…" : "تسجيل الدخول"}
        </button>
      </form>
    </AuthShell>
  );
}
