import { createFileRoute } from "@tanstack/react-router";

import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { Marquee } from "@/components/site/Marquee";
import { Employees } from "@/components/site/Employees";
import { Features } from "@/components/site/Features";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Testimonials } from "@/components/site/Testimonials";
import { Pricing } from "@/components/site/Pricing";
import { Faq } from "@/components/site/Faq";
import { CtaFooter } from "@/components/site/CtaFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "سهل | وظّف فريق موظفين ذكاء اصطناعي يعمل بالعربية 24/7" },
      {
        name: "description",
        content:
          "سهل: ستة موظفين بالذكاء الاصطناعي باشتراك واحد — ينشرون على 7 منصات، يصممون، يردّون على عملائك، ويتابعون مبيعاتك بالعربية وبلهجتك.",
      },
      { property: "og:title", content: "سهل | فريق موظفين ذكاء اصطناعي يعمل بالعربية" },
      {
        property: "og:description",
        content: "موظفون رقميون ينشرون ويصممون ويبيعون نيابة عنك — ابدأ مجاناً بدون بطاقة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Marquee />
      <Employees />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <Faq />
      <CtaFooter />
    </main>
  );
}
