import { createFileRoute } from "@tanstack/react-router";

import { PageShell, PageHero } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "شروط الاستخدام | اتفاقية واضحة بلا مفاجآت — سهل" },
      {
        name: "description",
        content: "شروط الاشتراك، الاستخدام المسموح، ملكية المحتوى، الفوترة، والإلغاء — بلغة مباشرة.",
      },
      { property: "og:title", content: "شروط الاستخدام — سهل" },
      { property: "og:description", content: "اتفاقية مكتوبة لتُقرأ، لا لتُتجاهل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

const sections = [
  {
    h: "الحساب",
    p: "أنت مسؤول عن صحة بيانات حسابك وسرية كلمة المرور. لا يجوز مشاركة الحساب بين كيانات مختلفة؛ للفرق استخدم باقة المؤسسات بصلاحيات متعددة.",
  },
  {
    h: "ملكية المحتوى",
    p: "المحتوى الذي ترفعه يبقى ملكك، والمحتوى الذي تولّده المنصة لحسابك يصبح ملكك أيضاً بمجرد إنشائه. نحتفظ بحق تشغيل النظام تقنياً لا أكثر.",
  },
  {
    h: "الاستخدام المقبول",
    p: "يُمنع استخدام المنصة في التضليل، انتحال الهوية، البريد المزعج، أو أي محتوى يخالف قوانين بلدك أو شروط المنصات المرتبطة. المخالفة توقف الحساب فوراً.",
  },
  {
    h: "دقة المخرجات",
    p: "المخرجات مساعدة إنتاجية وليست استشارة قانونية أو مالية أو طبية. راجع أي محتوى حسّاس قبل نشره؛ خاصية الموافقة المسبقة مفعّلة افتراضياً لهذا السبب.",
  },
  {
    h: "الفوترة والإلغاء",
    p: "الاشتراك شهري متجدد ما لم تلغه. الإلغاء يوقف التجديد من الدورة التالية، وتبقى الخدمة فعّالة حتى نهاية المدة المدفوعة. لا رسوم إلغاء.",
  },
  {
    h: "تعديل الشروط",
    p: "أي تعديل جوهري نُشعرك به عبر البريد قبل ٣٠ يوماً من سريانه، ولك حق الإلغاء دون رسوم خلال هذه المدة.",
  },
];

function TermsPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="قانوني"
        title="شروط الاستخدام"
        lead="اتفاقية قصيرة ومكتوبة لتُقرأ. آخر تحديث: يناير ٢٠٢٦."
      />
      <section className="mx-auto max-w-3xl space-y-8 px-5 py-14">
        {sections.map((s, i) => (
          <Reveal key={s.h} delay={i * 50}>
            <div>
              <h2 className="font-display text-2xl font-black">{s.h}</h2>
              <p className="mt-3 text-lg leading-[2] text-ink-soft">{s.p}</p>
            </div>
          </Reveal>
        ))}
      </section>
    </PageShell>
  );
}
