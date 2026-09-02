import {
  keywordExpansion,
  keywordMetrics,
  serpSearch,
  auditPage,
  competitorInventory,
  type SerpResult,
} from "./seo-research.server";
import { gscSnapshotFor } from "./gsc.functions";
import { ga4SnapshotFor } from "./ga4.functions";

export type ResearchPlan = {
  keywords?: string[];
  searches?: string[];
  urls?: string[];
  competitors?: string[];
  useSearchConsole?: boolean;
};

const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

/**
 * أفضل النماذج المجانية على OpenRouter بترتيب مُختبَر (جودة عربية + سرعة + توافر)،
 * مع تجاوز تلقائي عند 429/5xx أو رد فارغ.
 */
export const FREE_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "minimax/minimax-m3:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.7:free",
  "z-ai/glm-5.2:free",
  "openrouter/free",
];


/** نداء النموذج عبر OpenRouter (نماذج مجانية) مع تجاوز تلقائي بين النماذج. */
export async function freeChat(
  apiKey: string,
  messages: { role: string; content: string }[],
  options: { json?: boolean } = {},
): Promise<string> {
  let lastError = "";
  for (const model of FREE_MODELS) {
    let res: Response;
    try {
      res = await fetch(OPENROUTER, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://friendly-framework-fusion.lovable.app",
          "X-Title": "Nour AI Employee",
        },
        body: JSON.stringify({
          model,
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
          messages,
        }),
      });
    } catch {
      lastError = "تعذّر الاتصال بمزوّد النماذج";
      continue;
    }
    if (res.status === 401) throw new Error("مفتاح OpenRouter غير صالح.");
    if (res.ok) {
      const payload = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      };
      const content = payload.choices?.[0]?.message?.content ?? "";
      if (content.trim()) return content;
      lastError = payload.error?.message ?? "رد فارغ";
      continue;
    }
    // 429 (حد مجاني) أو 5xx: ننتقل للنموذج التالي بدل الفشل
    lastError = `${res.status}`;
  }
  throw new Error(`تعذّر توليد الرد من النماذج المجانية (${lastError}).`);

}

export function parseJson<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** المرحلة الأولى: يقرر النموذج ما يحتاجه من بيانات حقيقية قبل الإجابة. */
export async function planResearch(
  apiKey: string,
  brand: { name: string; industry: string },
  message: string,
): Promise<ResearchPlan> {
  const raw = await freeChat(
    apiKey,
    [
      {
        role: "system",
        content: [
          "أنت مخطِّط بحث لخبيرة سيو عربية. حدّد فقط البيانات الحقيقية اللازمة للإجابة على طلب المستخدم.",
          'أعد JSON فقط: {"keywords":["كلمة بذرية"],"searches":["استعلام بحث"],"urls":["رابط لتحليله"],"competitors":["نطاق منافس"],"useSearchConsole":true|false}',
          "قواعد: 0-3 كلمات بذرية، 0-3 استعلامات بحث، 0-2 روابط (فقط إن ذكر المستخدم رابطاً)، 0-2 نطاقات منافسة (فقط إن ذُكرت)، واستخدم useSearchConsole=true إذا كان السؤال عن أداء الموقع/الترتيب/النقرات.",
          "إن كان الطلب عاماً أو محادثة بسيطة، أعد كل الحقول فارغة.",
        ].join("\n"),
      },
      { role: "user", content: `العلامة: ${brand.name} (${brand.industry})\nالطلب: ${message}` },
    ],
    { json: true },
  );
  const plan = parseJson<ResearchPlan>(raw) ?? {};
  const clean = (arr: unknown, max: number) =>
    Array.isArray(arr)
      ? arr.filter((v): v is string => typeof v === "string" && v.trim().length > 1).slice(0, max)
      : [];
  return {
    keywords: clean(plan.keywords, 3),
    searches: clean(plan.searches, 3),
    urls: clean(plan.urls, 2).filter((u) => /^https?:\/\//.test(u)),
    competitors: clean(plan.competitors, 2),
    useSearchConsole: plan.useSearchConsole === true,
  };
}

export type Evidence = { block: string; sources: string[]; used: string[] };

/** المرحلة الثانية: تنفيذ البحث من مصادر مجانية وبناء كتلة أدلة للنموذج. */
export async function gatherEvidence(
  plan: ResearchPlan,
  workspaceId: string,
): Promise<Evidence> {
  const [keywordSets, metricSets, serpSets, audits, inventories, gsc, ga4] = await Promise.all([
    Promise.all((plan.keywords ?? []).map((k) => keywordExpansion(k))),
    Promise.all((plan.keywords ?? []).slice(0, 3).map((k) => keywordMetrics(k))),
    Promise.all((plan.searches ?? []).map(async (q) => ({ q, results: await serpSearch(q) }))),
    Promise.all((plan.urls ?? []).map((u) => auditPage(u))),
    Promise.all((plan.competitors ?? []).map((d) => competitorInventory(d))),
    plan.useSearchConsole ? gscSnapshotFor(workspaceId) : Promise.resolve(null),
    plan.useSearchConsole ? ga4SnapshotFor(workspaceId) : Promise.resolve(null),
  ]);

  const parts: string[] = [];
  const sources: string[] = [];
  const used: string[] = [];

  for (const set of keywordSets) {
    if (!set.suggestions.length) continue;
    used.push(`اقتراحات بحث: ${set.seed}`);
    parts.push(
      [
        `### كلمات يبحث عنها الناس فعلاً حول «${set.seed}» (اقتراحات Google/Bing)`,
        `- عبارات: ${set.suggestions.join(" | ")}`,
        set.informational.length ? `- نية معلوماتية: ${set.informational.join(" | ")}` : "",
        set.commercial.length ? `- نية مقارنة: ${set.commercial.join(" | ")}` : "",
        set.transactional.length ? `- نية شرائية: ${set.transactional.join(" | ")}` : "",
        set.local.length ? `- نية محلية: ${set.local.join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (metricSets.length) {
    used.push("مقاييس كلمات مجانية");
    parts.push(
      [
        "### مقاييس الكلمات المفتاحية (مصادر مجانية — تقديرية وموصوفة بصراحة)",
        ...metricSets.map((m) =>
          [
            `- «${m.keyword}»: مؤشر طلب ${m.demandScore}/100 (عمق اقتراحات ${m.suggestionDepth}${m.autocompleted ? "، تظهر في الإكمال التلقائي" : ""})`,
            m.difficultyScore !== null ? `  صعوبة تقديرية ${m.difficultyScore}/100 | نطاقات متصدرة: ${m.topDomains.join(", ")}` : "  صعوبة: غير متاحة الآن (لا تخمين)",
            m.wikipediaMonthlyViews !== null
              ? `  اهتمام مقيس: مقال ويكيبيديا «${m.wikipediaArticle}» ≈ ${m.wikipediaMonthlyViews} مشاهدة/شهر`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
        "ملاحظة إلزامية: لا تقدّم هذه الأرقام كحجم بحث شهري من أداة مدفوعة، بل كمؤشرات نسبية للمقارنة والترتيب.",
      ].join("\n"),
    );
  }

  for (const { q, results } of serpSets) {
    if (!results.length) continue;
    used.push(`نتائج بحث: ${q}`);
    parts.push(
      [
        `### نتائج البحث الحقيقية لـ «${q}»`,
        ...results.map((r: SerpResult) => `${r.rank}. ${r.title} — ${r.url}\n   ${r.snippet}`),
      ].join("\n"),
    );
    sources.push(...results.slice(0, 5).map((r) => r.url));
  }

  for (const a of audits) {
    used.push(`تحليل صفحة: ${a.url}`);
    parts.push(
      a.error
        ? `### تحليل ${a.url}\n- تعذّر الجلب: ${a.error}`
        : [
            `### تحليل تقني للصفحة ${a.url}`,
            `- الحالة: ${a.status} | اللغة: ${a.lang || "غير محددة"} | عدد الكلمات: ${a.wordCount}`,
            `- العنوان: ${a.title || "(مفقود)"} (${a.title.length} حرف)`,
            `- وصف ميتا: ${a.metaDescription || "(مفقود)"} (${a.metaDescription.length} حرف)`,
            `- H1: ${a.h1.join(" | ") || "(مفقود)"}`,
            `- H2: ${a.h2.join(" | ") || "(لا يوجد)"}`,
            `- canonical: ${a.hasCanonical ? "موجود" : "مفقود"} | بيانات منظمة: ${a.hasSchema ? "موجودة" : "مفقودة"}`,
            `- صور بلا alt: ${a.imagesWithoutAlt} | روابط داخلية: ${a.internalLinks}`,
          ].join("\n"),
    );
    if (!a.error) sources.push(a.url);
  }

  for (const inv of inventories) {
    used.push(`جرد منافس: ${inv.domain}`);
    parts.push(
      inv.error
        ? `### جرد ${inv.domain}\n- ${inv.error}`
        : [
            `### جرد محتوى المنافس ${inv.domain} (من خريطة الموقع)`,
            `- عدد الصفحات المكتشفة: ${inv.urlCount}`,
            `- أكثر الكلمات تكراراً في عناوين الروابط: ${inv.topics.join(" | ")}`,
            `- نماذج صفحات: ${inv.samples.map((s) => s.slug || s.url).slice(0, 15).join(" | ")}`,
          ].join("\n"),
    );
    if (!inv.error) sources.push(inv.domain);
  }

  if (gsc) {
    used.push("بيانات Search Console");
    const fmt = (rows: typeof gsc.queries) =>
      rows
        .slice(0, 15)
        .map(
          (r) =>
            `- ${r.key}: نقرات ${r.clicks} | ظهور ${r.impressions} | CTR ${(r.ctr * 100).toFixed(1)}% | متوسط الترتيب ${r.position.toFixed(1)}`,
        )
        .join("\n");
    parts.push(
      [
        `### بيانات Search Console الحقيقية للموقع ${gsc.site} (${gsc.range.start} → ${gsc.range.end})`,
        "أعلى الاستعلامات:",
        fmt(gsc.queries) || "- لا بيانات",
        "أعلى الصفحات:",
        fmt(gsc.pages) || "- لا بيانات",
      ].join("\n"),
    );
  }

  if (ga4) {
    used.push("بيانات Google Analytics 4");
    parts.push(
      [
        `### بيانات GA4 الحقيقية (خاصية ${ga4.property}، ${ga4.range.start} → ${ga4.range.end})`,
        `الإجمالي: جلسات ${ga4.totals.sessions} | مستخدمون ${ga4.totals.users} | جلسات متفاعلة ${ga4.totals.engagedSessions}`,
        "القنوات:",
        ga4.channels.map((c) => `- ${c.channel}: ${c.sessions} جلسة`).join("\n") || "- لا بيانات",
        "أعلى صفحات الهبوط من البحث العضوي:",
        ga4.organicLandingPages.map((p) => `- ${p.page}: ${p.sessions} جلسة`).join("\n") ||
          "- لا بيانات",
      ].join("\n"),
    );
  }

  return { block: parts.join("\n\n"), sources: Array.from(new Set(sources)), used };
}
