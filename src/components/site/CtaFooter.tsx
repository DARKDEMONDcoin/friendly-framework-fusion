import { ArrowLeft, Sparkles } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const cols = [
  { t: "المنتج", l: ["الموظفون", "المزايا", "الأسعار", "التحديثات"] },
  { t: "الشركة", l: ["من نحن", "المدونة", "وظائف", "تواصل معنا"] },
  { t: "قانوني", l: ["الخصوصية", "الشروط", "الأمان", "معالجة البيانات"] },
];

export function CtaFooter() {
  return (
    <>
      <section id="cta" className="scroll-mt-24 px-5 pb-24">
        <Reveal>
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] p-10 text-center md:p-20">
            <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "var(--gradient-aurora)", backgroundSize: "200% 200%", animation: "aurora-pan 14s ease-in-out infinite" }} />
            <div aria-hidden className="grid-lines absolute inset-0 opacity-40" />
            <div className="relative">
              <h2 className="font-display text-4xl leading-tight font-black text-white md:text-6xl">
                فريقك الجديد جاهز للعمل الليلة
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-white/90">
                ابدأ مجاناً بدون بطاقة ائتمان. أول منشور خلال دقائق، وأول تقرير خلال أسبوع.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <a
                  href="#top"
                  className="group inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 font-bold text-background transition-transform duration-300 hover:-translate-y-1"
                >
                  وظّف فريقك الآن
                  <ArrowLeft className="size-5 transition-transform duration-300 group-hover:-translate-x-1" />
                </a>
                <a
                  href="#pricing"
                  className="inline-flex items-center rounded-full border border-white/60 bg-white/15 px-7 py-4 font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
                >
                  شاهد الأسعار
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="grid size-9 place-items-center rounded-xl text-primary-foreground"
                style={{ backgroundImage: "var(--gradient-aurora)" }}
              >
                <Sparkles className="size-4.5" strokeWidth={2.4} />
              </span>
              <span className="font-display text-xl font-extrabold">سهل</span>
            </div>
            <p className="mt-4 max-w-xs leading-relaxed text-muted-foreground">
              فريق موظفين بالذكاء الاصطناعي، يعمل بالعربية على مدار الساعة لأصحاب المشاريع.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.t}>
              <h3 className="font-display font-extrabold">{c.t}</h3>
              <ul className="mt-4 space-y-2.5">
                {c.l.map((l) => (
                  <li key={l}>
                    <a
                      href="#top"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      {l}
                    </a>
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
    </>
  );
}
