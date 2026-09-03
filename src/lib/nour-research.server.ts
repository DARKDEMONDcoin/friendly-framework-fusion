import {
  keywordExpansion,
  keywordMetrics,
  serpSearch,
  auditPage,
  competitorInventory,
  contentBrief,
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
 * مع تجاوز تلقائي عند 429/5xx أو رد فارغ أو تجاوز المهلة.
 */
export const FREE_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "minimax/minimax-m3:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.7:free",
  "z-ai/glm-5.2:free",
];

export type ChatOptions = {
  json?: boolean;
  /** مهلة كل نموذج بالمللي ثانية (تمنع التعليق نهائياً). */
  timeoutMs?: number;
  maxTokens?: number;
  /** عدد النماذج التي نجربها قبل الاستسلام. */
  attempts?: number;
  /** نجرّب أول نموذجين بالتوازي: أول رد يفوز — أسرع زمن وصول ممكن. */
  race?: boolean;
};

async function callModel(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  options: ChatOptions,
): Promise<string> {
  const res = await fetch(OPENROUTER, {
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
      max_tokens: options.maxTokens ?? 1800,
      messages,
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  if (res.status === 401) throw new Error("مفتاح OpenRouter غير صالح.");
  if (!res.ok) throw new Error(`${model}: ${res.status}`);
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error(`${model}: رد فارغ`);
  return content;
}

/** نداء النموذج عبر OpenRouter (نماذج مجانية) مع تجاوز تلقائي بين النماذج. */
export async function freeChat(
  apiKey: string,
  messages: { role: string; content: string }[],
  options: ChatOptions = {},
): Promise<string> {
  const pool = FREE_MODELS.slice(0, options.attempts ?? FREE_MODELS.length);
  let lastError = "";

  if (options.race !== false && pool.length > 1) {
    // أول نموذجين بالتوازي: يقلّل زمن الانتظار إلى أسرع نموذج متاح لحظياً.
    try {
      return await Promise.any(pool.slice(0, 2).map((m) => callModel(apiKey, m, messages, options)));
    } catch (error) {
      const first = (error as AggregateError).errors?.[0] as Error | undefined;
      if (first?.message.includes("مفتاح OpenRouter")) throw first;
      lastError = first?.message ?? "فشل النموذجان الأسرع";
    }
  }

  for (const model of pool.slice(options.race === false ? 0 : 2)) {
    try {
      return await callModel(apiKey, model, messages, options);
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes("مفتاح OpenRouter")) throw error;
      lastError = message;
    }
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
    { json: true, timeoutMs: 9_000, maxTokens: 300, attempts: 3 },
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
  const [keywordSets, metricSets, serpSets, audits, inventories, gsc, ga4, brief] = await Promise.all([
    Promise.all((plan.keywords ?? []).map((k) => keywordExpansion(k))),
    Promise.all((plan.keywords ?? []).slice(0, 3).map((k) => keywordMetrics(k))),
    Promise.all((plan.searches ?? []).map(async (q) => ({ q, results: await serpSearch(q) }))),
    Promise.all((plan.urls ?? []).map((u) => auditPage(u))),
    Promise.all((plan.competitors ?? []).map((d) => competitorInventory(d))),
    plan.useSearchConsole ? gscSnapshotFor(workspaceId) : Promise.resolve(null),
    plan.useSearchConsole ? ga4SnapshotFor(workspaceId) : Promise.resolve(null),
    (plan.searches ?? [])[0]
      ? contentBrief((plan.searches ?? [])[0]!, (plan.urls ?? [])[0])
      : Promise.resolve(null),
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

  if (brief && brief.analyzed > 0) {
    used.push(`موجز محتوى تنافسي: ${brief.query}`);
    parts.push(
      [
        `### موجز محتوى مبني على الصفحات المتصدرة فعلاً لـ «${brief.query}» (${brief.analyzed} صفحة محلّلة)`,
        `- طول المحتوى الوسيط: ${brief.medianWordCount} كلمة | الطول المستهدف للتفوّق: ${brief.targetWordCount} كلمة`,
        `- نسبة استخدام البيانات المنظمة بين المتصدرين: ${brief.schemaCoverage}%`,
        brief.commonTerms.length
          ? `- مصطلحات/كيانات يغطيها المتصدرون: ${brief.commonTerms.map((t) => `${t.term} (${t.pages})`).join(" | ")}`
          : "",
        brief.entityGaps.length ? `- فجوات في صفحتك يجب تغطيتها: ${brief.entityGaps.join(" | ")}` : "",
        brief.headingIdeas.length
          ? `- عناوين فرعية مستخدمة فعلاً: ${brief.headingIdeas.slice(0, 12).join(" | ")}`
          : "",
        `- المنافسون: ${brief.competitors.map((c) => `${c.url} (${c.words} كلمة، ${c.h2} عنوان فرعي)`).join(" | ")}`,
        ...brief.notes.map((n) => `- ملاحظة: ${n}`),
      ]
        .filter(Boolean)
        .join("\n"),
    );
    sources.push(...brief.competitors.map((c) => c.url));
  }

  return { block: parts.join("\n\n"), sources: Array.from(new Set(sources)), used };
}
