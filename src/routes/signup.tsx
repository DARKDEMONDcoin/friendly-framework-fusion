import { createFileRoute, redirect } from "@tanstack/react-router";

/** صفحة التسجيل مخفية حالياً — كل الزيارات تُحوَّل إلى تسجيل الدخول. */
export const Route = createFileRoute("/signup")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — سهل" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => null,
});
