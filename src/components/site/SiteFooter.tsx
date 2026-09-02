import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { AppIcon } from "@/components/site/AppIcon";

const cols: { t: string; l: { label: string; to: string }[] }[] = [
  {
    t: "المنتج",
    l: [
      { label: "الموظفون", to: "/employees" },
      { label: "المزايا", to: "/features" },
      { label: "كيف يعمل", to: "/how-it-works" },
      { label: "الأسعار", to: "/pricing" },
      { label: "الأسئلة الشائعة", to: "/faq" },
    ],
  },
  {
    t: "الشركة",
    l: [
      { label: "من نحن", to: "/about" },
      { label: "قصص النجاح", to: "/stories" },
      { label: "المدونة", to: "/blog" },
      { label: "تواصل معنا", to: "/contact" },
    ],
  },
  {
    t: "قانوني وأمان",
    l: [
      { label: "الأمان", to: "/security" },
      { label: "الخصوصية", to: "/privacy" },
      { label: "الشروط", to: "/terms" },
      { label: "جرّب الموظفين", to: "/app" },
    ],
  },
];

const integrations = ["instagram", "linkedin", "x", "tiktok", "gmail", "slack", "notion", "shopify"];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link to="/" className="flex items-center gap-2.5">
            <span
              className="grid size-9 place-items-center rounded-xl text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-aurora)" }}
            >
              <Sparkles className="size-4.5" strokeWidth={2.4} />
            </span>
            <span className="font-display text-xl font-extrabold">سهل</span>
          </Link>
          <p className="mt-4 max-w-xs leading-relaxed text-muted-foreground">
            فريق موظفين بالذكاء الاصطناعي، يعمل بالعربية على مدار الساعة لأصحاب المشاريع — ينشر،
            يصمّم، يردّ، ويبيع نيابة عنك.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {integrations.map((a) => (
              <AppIcon key={a} name={a} className="size-5 opacity-80" />
            ))}
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.t}>
            <h3 className="font-display font-extrabold">{c.t}</h3>
            <ul className="mt-4 space-y-2.5">
              {c.l.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} سهل. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
