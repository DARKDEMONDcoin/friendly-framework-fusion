import {
  keywordExpansion,
  serpSearch,
  auditPage,
  competitorInventory,
  type SerpResult,
} from "./seo-research.server";
import { gscSnapshotFor } from "./gsc.functions";

export type ResearchPlan = {
  keywords?: string[];
  searches?: string[];
  urls?: string[];
  competitors?: string[];
  useSearchConsole?: boolean;
};

const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
const FREE_MODELS = [
  "z-ai/glm-5.2:free",
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

/** نداء مجاني للنموذج مع تجاوز تلقائي بين النماذج المجانية. */
export async function freeChat(
  apiKey: string,
  messages: { role: string; content: string }[],
  options: { json?: boolean } = {},
): Promise<string> {
  const res = await fetch(OPENROUTER, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: FREE_MODELS[0],
      models: FREE_MODELS,
      route: "fallback",
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  if (res.status === 429) throw new Error("تجاوزت حد الاستخدام مؤقتاً — حاول بعد قليل.");
  if (res.status === 402) throw new Error("رصيد الذكاء الاصطناعي غير كافٍ — أضف رصيداً للمتابعة.");
  if (!res.ok) throw new Error(`تعذّر توليد الرد (${res.status}).`);
  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return payload.choices?.[0]?.message?.content ?? "";
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
  const [keywordSets, serpSets, audits, inventories, gsc] = await Promise.all([
    Promise.all((plan.keywords ?? []).map((k) => keywordExpansion(k))),
    Promise.all((plan.searches ?? []).map(async (q) => ({ q, results: await serpSearch(q) }))),
    Promise.all((plan.urls ?? []).map((u) => auditPage(u))),
    Promise.all((plan.competitors ?? []).map((d) => competitorInventory(d))),
    plan.useSearchConsole ? gscSnapshotFor(workspaceId) : Promise.resolve(null),
  ]);

  const parts: string[] = [];
  const sources: string[] = [];
  const used: string[] = [];

  for (const set of keywordSets) {
    if (!set.suggestions.length && !set.questions.length) continue;
    used.push(`اقتراحات بحث: ${set.seed}`);
    parts.push(
      [
        `### كلمات يبحث عنها الناس فعلاً حول «${set.seed}» (اقتراحات Google/Bing)`,
        set.suggestions.length ? `- عبارات: ${set.suggestions.join(" | ")}` : "",
        set.questions.length ? `- أسئلة: ${set.questions.join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
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

  return { block: parts.join("\n\n"), sources: Array.from(new Set(sources)), used };
}
