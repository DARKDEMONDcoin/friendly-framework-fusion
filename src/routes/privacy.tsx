import { createFileRoute } from "@tanstack/react-router";

import { PageShell, PageHero } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية | كيف نتعامل مع بياناتك — سهل" },
      {
        name: "description",
        content: "ما نجمعه، لماذا نجمعه، أين يُخزَّن، وكيف تحذفه أو تصدّره في أي وقت.",
      },
      { property: "og:title", content: "سياسة الخصوصية — سهل" },
      { property: "og:description", content: "شفافية كاملة في التعامل مع بياناتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

const sections = [
  {
    h: "ما الذي نجمعه",
    p: "بيانات الحساب (الاسم، البريد، اسم النشاط)، محتوى علامتك الذي ترفعه، ورموز الوصول للحسابات التي تربطها. لا نطلب بيانات لا يحتاجها التشغيل.",
  },
  {
    h: "لماذا نجمعه",
    p: "لتشغيل موظفيك الرقميين فقط: توليد المحتوى بنبرتك، النشر في حساباتك بإذنك، وإعداد تقاريرك. لا نبيع البيانات ولا نشاركها لأغراض إعلانية.",
  },
  {
    h: "التدريب على النماذج",
    p: "لا نستخدم محتواك لتدريب نماذج عامة. ما ترفعه يبقى مخصّصاً لحسابك ولتحسين مخرجاتك أنت.",
  },
  {
    h: "التخزين والحماية",
    p: "البيانات مشفَّرة أثناء النقل والتخزين، ورموز الوصول محفوظة في خزنة أسرار منفصلة. الوصول الداخلي مقيّد ومسجَّل في سجل تدقيق.",
  },
  {
    h: "حقوقك",
    p: "يمكنك تصدير بياناتك كاملة، أو حذف حسابك نهائياً في أي وقت. بعد الحذف تُزال بياناتك خلال ٣٠ يوماً من النسخ الاحتياطية.",
  },
  {
    h: "ملفات الارتباط",
    p: "نستخدم ملفات ارتباط ضرورية لتسجيل الدخول، وقياساً مجهّلاً لتحسين المنتج. لا تتبّع إعلانياً عبر المواقع.",
  },
];

function PrivacyPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="قانوني"
        title="سياسة الخصوصية"
        lead="مكتوبة بلغة مفهومة، لا بفقرات قانونية غامضة. آخر تحديث: يناير ٢٠٢٦."
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
