import { useState } from "react";
import { Check } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "البداية",
    monthly: 0,
    tag: "مجاني للأبد",
    desc: "لتجربة الفريق على مشروع واحد.",
    features: ["موظف واحد", "منصتان للنشر", "30 مهمة شهرياً", "مراجعة يدوية قبل النشر"],
    cta: "ابدأ الآن",
    highlight: false,
  },
  {
    name: "النمو",
    monthly: 149,
    tag: "الأكثر اختياراً",
    desc: "لصاحب مشروع يريد فريقاً كاملاً.",
    features: [
      "6 موظفين مفعّلين",
      "7 منصات نشر",
      "1,500 مهمة شهرياً",
      "توليد صور وفيديو قصير",
      "رصيد يترحّل للشهر التالي",
    ],
    cta: "جرّب 14 يوم مجاناً",
    highlight: true,
  },
  {
    name: "الوكالات",
    monthly: 399,
    tag: "متعدد العملاء",
    desc: "لإدارة عدة علامات تجارية.",
    features: [
      "علامات تجارية غير محدودة",
      "مهام غير محدودة عملياً",
      "صلاحيات فريق وتقارير بعلامتك",
      "مدير حساب مخصص",
    ],
    cta: "تواصل معنا",
    highlight: false,
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <section id="pricing" className="scroll-mt-24 border-y border-border bg-secondary/40 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <div className="text-center">
            <p className="text-sm font-bold tracking-wider text-primary">الأسعار</p>
            <h2 className="mt-3 font-display text-4xl font-black md:text-5xl">
              أرخص من راتب متدرّب
            </h2>
            <div className="mt-7 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
              {[
                { l: "سنوي · وفّر 20%", v: true },
                { l: "شهري", v: false },
              ].map((o) => (
                <button
                  key={o.l}
                  onClick={() => setYearly(o.v)}
                  className={cn(
                    "rounded-full px-5 py-2 text-sm font-bold transition-all duration-300",
                    yearly === o.v
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid items-start gap-5 md:grid-cols-3">
          {plans.map((p, i) => {
            const price = p.monthly === 0 ? 0 : yearly ? Math.round(p.monthly * 0.8) : p.monthly;
            return (
              <Reveal key={p.name} delay={i * 90}>
                <article
                  className={cn(
                    "relative h-full rounded-3xl border p-8 transition-all duration-400 hover:-translate-y-1",
                    p.highlight
                      ? "border-transparent shadow-lift"
                      : "border-border bg-card shadow-card",
                  )}
                  style={p.highlight ? { backgroundImage: "var(--gradient-ink)" } : undefined}
                >
                  <span
                    className={cn(
                      "inline-block rounded-full px-3 py-1 text-xs font-bold",
                      p.highlight ? "bg-amber text-ink" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {p.tag}
                  </span>
                  <h3
                    className={cn(
                      "mt-4 font-display text-2xl font-black",
                      p.highlight && "text-background",
                    )}
                  >
                    {p.name}
                  </h3>
                  <p className={cn("mt-1 text-sm", p.highlight ? "text-background/70" : "text-muted-foreground")}>
                    {p.desc}
                  </p>

                  <div className="mt-6 flex items-end gap-1.5">
                    <span
                      className={cn(
                        "font-display text-5xl font-black tabular-nums",
                        p.highlight && "text-background",
                      )}
                    >
                      {price}
                    </span>
                    <span
                      className={cn(
                        "pb-2 text-sm",
                        p.highlight ? "text-background/70" : "text-muted-foreground",
                      )}
                    >
                      ر.س / شهرياً
                    </span>
                  </div>

                  <a
                    href="#cta"
                    className={cn(
                      "mt-6 block rounded-full py-3 text-center font-bold transition-transform duration-300 hover:-translate-y-0.5",
                      p.highlight
                        ? "bg-background text-foreground"
                        : "bg-foreground text-background",
                    )}
                  >
                    {p.cta}
                  </a>

                  <ul className="mt-7 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check
                          className={cn(
                            "mt-0.5 size-4.5 shrink-0",
                            p.highlight ? "text-amber" : "text-jade-deep",
                          )}
                          strokeWidth={3}
                        />
                        <span className={cn("text-sm", p.highlight ? "text-background/90" : "text-ink-soft")}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
