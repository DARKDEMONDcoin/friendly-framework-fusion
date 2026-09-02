/**
 * مصادر بحث مجانية بالكامل (بدون أي مفاتيح مدفوعة):
 * - اقتراحات جوجل/بينج: أسئلة وكلمات يبحث عنها الناس فعلاً.
 * - نتائج DuckDuckGo HTML: عناوين ووصف الصفحات المنافسة الحقيقية.
 * - قارئ صفحات: عنوان/وصف/عناوين فرعية/عدد كلمات لأي رابط.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const timeout = (ms: number) => AbortSignal.timeout(ms);

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x?([0-9a-f]+);/gi, (_m, code: string) =>
      String.fromCharCode(/^x/i.test(_m.slice(2, 3)) ? parseInt(code, 16) : Number(code)),
    );
}

const strip = (html: string) =>
  decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** اقتراحات بحث حقيقية من جوجل (مجاني، بلا مفتاح). */
export async function googleSuggest(query: string, hl = "ar", gl = "sa"): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&gl=${gl}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[]];
    return (data[1] ?? []).slice(0, 12);
  } catch {
    return [];
  }
}

/** اقتراحات بينج كمصدر مكمّل (مجاني، بلا مفتاح). */
export async function bingSuggest(query: string, market = "ar-SA"): Promise<string[]> {
  try {
    const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}&market=${market}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[]];
    return (data[1] ?? []).slice(0, 10);
  } catch {
    return [];
  }
}

export type KeywordExpansion = {
  seed: string;
  suggestions: string[];
  informational: string[];
  commercial: string[];
  transactional: string[];
  local: string[];
};

/**
 * توسيع الكلمة المفتاحية من اقتراحات Google/Bing الحقيقية، مع تصنيف النية:
 * معلوماتية / مقارنة / شرائية / محلية — مجاني بالكامل.
 */
export async function keywordExpansion(seed: string): Promise<KeywordExpansion> {
  const prefixes = ["طريقة", "أفضل", "سعر", "كم سعر", "شركة", "مقارنة", "أرخص", "هل يجوز"];
  const suffixes = ["", " ", " في", " بال"];
  const batches = await Promise.all([
    googleSuggest(seed),
    bingSuggest(seed),
    ...prefixes.map((p) => googleSuggest(`${p} ${seed}`)),
    ...suffixes.map((s) => googleSuggest(`${seed}${s}`)),
  ]);

  const unique = Array.from(
    new Set(batches.flat().map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 2)),
  );

  const has = (s: string, words: string[]) => words.some((w) => s.includes(w));
  const informational = unique.filter((s) =>
    has(s, ["كيف", "طريقة", "ما هو", "ماهو", "لماذا", "هل", "خطوات", "فوائد", "أضرار", "معنى"]),
  );
  const commercial = unique.filter(
    (s) => !informational.includes(s) && has(s, ["أفضل", "افضل", "مقارنة", "مقابل", "أم", "تقييم", "مراجعة"]),
  );
  const transactional = unique.filter(
    (s) =>
      !informational.includes(s) &&
      !commercial.includes(s) &&
      has(s, ["سعر", "أسعار", "اسعار", "كم", "شراء", "أرخص", "ارخص", "عرض", "خصم", "شركة", "رقم", "حجز"]),
  );
  const local = unique.filter((s) =>
    has(s, [
      "الرياض", "جدة", "مكة", "المدينة", "الدمام", "الخبر", "القاهرة", "الإسكندرية", "دبي",
      "أبوظبي", "الكويت", "الدوحة", "مسقط", "المنامة", "عمان", "قريب", "قرب",
    ]),
  );

  return {
    seed,
    suggestions: unique.slice(0, 40),
    informational: informational.slice(0, 15),
    commercial: commercial.slice(0, 15),
    transactional: transactional.slice(0, 15),
    local: local.slice(0, 15),
  };
}

export type SerpResult = { rank: number; title: string; url: string; snippet: string };

async function getText(url: string, ms = 12_000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.8" },
      signal: timeout(ms),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * نتائج بحث عامة (أفضل جهد) من مصادر مجانية بلا مفاتيح.
 * إن رفضت كل المصادر الطلب تُعيد قائمة فارغة، وتعتمد نور على المصادر الأخرى بدل اختلاق نتائج.
 */
export async function serpSearch(query: string): Promise<SerpResult[]> {
  const attempts: (() => Promise<SerpResult[]>)[] = [
    // 1) DuckDuckGo Lite
    async () => {
      const html = await getText(
        `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}&kl=xa-ar`,
      );
      const out: SerpResult[] = [];
      const rx = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(html)) && out.length < 10) {
        let href = decodeEntities(m[1] ?? "");
        const uddg = /[?&]uddg=([^&]+)/.exec(href);
        if (uddg?.[1]) href = decodeURIComponent(uddg[1]);
        if (!/^https?:\/\//.test(href)) continue;
        out.push({ rank: out.length + 1, title: strip(m[2] ?? "").slice(0, 200), url: href, snippet: "" });
      }
      return out;
    },
    // 2) Mojeek (محرك مستقل يسمح بالقراءة)
    async () => {
      const html = await getText(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}`);
      const out: SerpResult[] = [];
      const rx = /<a[^>]+class="title"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(html)) && out.length < 10) {
        const href = decodeEntities(m[1] ?? "");
        if (!/^https?:\/\//.test(href)) continue;
        out.push({ rank: out.length + 1, title: strip(m[2] ?? "").slice(0, 200), url: href, snippet: "" });
      }
      return out;
    },
    // 3) ويكيبيديا العربية: مصدر مرجعي مضمون لتغطية المفاهيم
    async () => {
      const json = await getText(
        `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5&origin=*`,
      );
      if (!json.trim().startsWith("{")) return [];
      const data = JSON.parse(json) as {
        query?: { search?: { title: string; snippet: string }[] };
      };
      return (data.query?.search ?? []).map((r, i) => ({
        rank: i + 1,
        title: r.title,
        url: `https://ar.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
        snippet: strip(r.snippet).slice(0, 300),
      }));
    },
  ];

  for (const attempt of attempts) {
    try {
      const results = await attempt();
      if (results.length) return results;
    } catch {
      // نتابع للمصدر التالي
    }
  }
  return [];
}

export type CompetitorInventory = {
  domain: string;
  sitemaps: string[];
  urlCount: number;
  samples: { url: string; slug: string }[];
  topics: string[];
  error?: string;
};

/** جرد محتوى منافس من robots.txt وخرائط الموقع — مجاني ودقيق. */
export async function competitorInventory(domainOrUrl: string): Promise<CompetitorInventory> {
  const base = (() => {
    try {
      const u = new URL(/^https?:\/\//.test(domainOrUrl) ? domainOrUrl : `https://${domainOrUrl}`);
      return `${u.protocol}//${u.host}`;
    } catch {
      return "";
    }
  })();
  if (!base) return { domain: domainOrUrl, sitemaps: [], urlCount: 0, samples: [], topics: [], error: "نطاق غير صالح" };

  const robots = await getText(`${base}/robots.txt`, 8000);
  let sitemaps = [...robots.matchAll(/Sitemap:\s*(\S+)/gi)]
    .map((m) => m[1]!)
    .filter((s) => /^https?:\/\//.test(s))
    .slice(0, 3);
  if (!sitemaps.length) sitemaps = [`${base}/sitemap.xml`];

  const urls: string[] = [];
  const seen = new Set<string>();
  const queue = [...sitemaps];
  let fetched = 0;
  while (queue.length && urls.length < 120 && fetched < 6) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    const xml = await getText(next, 10_000);
    fetched += 1;
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]!);
    for (const loc of locs) {
      if (/\.xml(\.gz)?$/i.test(loc)) {
        if (queue.length < 6) queue.push(loc);
      } else if (urls.length < 120) {
        urls.push(loc);
      }
    }
  }

  const slugOf = (u: string) => {
    try {
      const path = decodeURIComponent(new URL(u).pathname);
      return path.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ").slice(0, 120) ?? "";
    } catch {
      return "";
    }
  };
  const samples = urls.slice(0, 40).map((u) => ({ url: u, slug: slugOf(u) }));
  const words = new Map<string, number>();
  for (const s of samples) {
    for (const w of s.slug.split(/\s+/)) {
      if (w.length > 2) words.set(w, (words.get(w) ?? 0) + 1);
    }
  }
  const topics = [...words.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([w, c]) => `${w} (${c})`);

  return {
    domain: base,
    sitemaps,
    urlCount: urls.length,
    samples: samples.slice(0, 20),
    topics,
    ...(urls.length ? {} : { error: "لم أجد خريطة موقع مقروءة" }),
  };
}

export type PageAudit = {
  url: string;
  status: number;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  lang: string;
  hasCanonical: boolean;
  hasSchema: boolean;
  imagesWithoutAlt: number;
  internalLinks: number;
  error?: string;
};

/** قراءة أي صفحة وتحليلها تقنياً — مجاني (زحف مباشر). */
export async function auditPage(url: string): Promise<PageAudit> {
  const empty: PageAudit = {
    url,
    status: 0,
    title: "",
    metaDescription: "",
    h1: [],
    h2: [],
    wordCount: 0,
    lang: "",
    hasCanonical: false,
    hasSchema: false,
    imagesWithoutAlt: 0,
    internalLinks: 0,
  };
  try {
    const target = new URL(url);
    if (!/^https?:$/.test(target.protocol)) return { ...empty, error: "رابط غير مدعوم" };
    const res = await fetch(target.toString(), {
      headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.8" },
      signal: timeout(15_000),
    });
    const html = (await res.text()).slice(0, 900_000);
    const pick = (re: RegExp) => strip(re.exec(html)?.[1] ?? "");
    const all = (re: RegExp, limit = 12) => {
      const out: string[] = [];
      let m: RegExpExecArray | null;
      const rx = new RegExp(re.source, "gi");
      while ((m = rx.exec(html)) && out.length < limit) {
        const t = strip(m[1] ?? "");
        if (t) out.push(t.slice(0, 160));
      }
      return out;
    };
    const body = strip(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " "),
    );
    const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
    const links = html.match(/<a\b[^>]*href="([^"]+)"/gi) ?? [];
    return {
      url: target.toString(),
      status: res.status,
      title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
      metaDescription:
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ?? "",
      h1: all(/<h1[^>]*>([\s\S]*?)<\/h1>/i, 5),
      h2: all(/<h2[^>]*>([\s\S]*?)<\/h2>/i, 15),
      wordCount: body ? body.split(/\s+/).length : 0,
      lang: /<html[^>]+lang=["']([^"']+)["']/i.exec(html)?.[1] ?? "",
      hasCanonical: /rel=["']canonical["']/i.test(html),
      hasSchema: /application\/ld\+json/i.test(html),
      imagesWithoutAlt: imgs.filter((t) => !/\balt=/i.test(t)).length,
      internalLinks: links.filter((a) => {
        const href = /href="([^"]+)"/i.exec(a)?.[1] ?? "";
        return href.startsWith("/") || href.includes(target.host);
      }).length,
    };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "تعذّر جلب الصفحة" };
  }
}

export type KeywordMetric = {
  keyword: string;
  /** 0-100: مؤشر طلب تقديري مبني على عمق اقتراحات جوجل/بينج الحقيقية. */
  demandScore: number;
  /** عدد الاقتراحات التي يعرضها محرك البحث لهذه العبارة. */
  suggestionDepth: number;
  /** هل العبارة نفسها تظهر ضمن اقتراحات محرك البحث (دليل طلب فعلي). */
  autocompleted: boolean;
  /** 0-100: صعوبة تقديرية مبنية على قوة النطاقات في نتائج البحث الحقيقية. */
  difficultyScore: number | null;
  /** نطاقات تتصدر النتائج فعلاً. */
  topDomains: string[];
  /** متوسط مشاهدات شهرية لمقال ويكيبيديا العربي الأقرب (اهتمام حقيقي مُقاس). */
  wikipediaMonthlyViews: number | null;
  wikipediaArticle: string | null;
  notes: string[];
};

const STRONG_DOMAINS = [
  "wikipedia.org", "youtube.com", "amazon.", "noon.com", "aljazeera.net", "alarabiya.net",
  "reddit.com", "quora.com", "linkedin.com", "facebook.com", "gov.sa", "gov.ae", "moe.gov",
];

/** مشاهدات شهرية حقيقية لأقرب مقال ويكيبيديا عربي (Wikimedia REST — مجاني بلا مفتاح). */
async function wikipediaInterest(
  keyword: string,
): Promise<{ article: string; monthlyViews: number } | null> {
  try {
    const search = await getText(
      `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keyword)}&format=json&srlimit=1&origin=*`,
      8000,
    );
    if (!search.trim().startsWith("{")) return null;
    const title = (JSON.parse(search) as { query?: { search?: { title: string }[] } }).query
      ?.search?.[0]?.title;
    if (!title) return null;

    const end = new Date();
    const start = new Date(end.getTime() - 365 * 86_400_000);
    const fmt = (d: Date) => `${d.toISOString().slice(0, 10).replace(/-/g, "")}00`;
    const raw = await getText(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ar.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, "_"))}/monthly/${fmt(start)}/${fmt(end)}`,
      9000,
    );
    if (!raw.trim().startsWith("{")) return null;
    const items = (JSON.parse(raw) as { items?: { views: number }[] }).items ?? [];
    if (!items.length) return null;
    const avg = Math.round(items.reduce((s, i) => s + i.views, 0) / items.length);
    return { article: title, monthlyViews: avg };
  } catch {
    return null;
  }
}

/**
 * مقاييس كلمات مفتاحية من مصادر مجانية بالكامل وبلا اختلاق:
 * عمق الاقتراحات الحقيقية + ظهور العبارة في الإكمال التلقائي + قوة نطاقات النتائج
 * + مشاهدات ويكيبيديا العربية المقيسة. كل رقم موصوف كتقديري أو مقيس بوضوح.
 */
export async function keywordMetrics(keyword: string): Promise<KeywordMetric> {
  const seed = keyword.trim();
  const notes: string[] = [];
  const [google, bing, wiki, serp] = await Promise.all([
    googleSuggest(seed),
    bingSuggest(seed),
    wikipediaInterest(seed),
    serpSearch(seed),
  ]);

  const suggestions = Array.from(new Set([...google, ...bing]));
  const autocompleted = suggestions.some((s) => s.trim() === seed);
  const suggestionDepth = suggestions.length;

  let demandScore = Math.min(100, suggestionDepth * 5 + (autocompleted ? 25 : 0));
  if (wiki) demandScore = Math.min(100, demandScore + Math.min(25, Math.round(wiki.monthlyViews / 200)));
  if (!suggestionDepth) notes.push("لا اقتراحات من محركات البحث لهذه العبارة — طلب ضعيف أو صياغة غير شائعة.");

  const topDomains = Array.from(
    new Set(
      serp
        .map((r) => {
          try {
            return new URL(r.url).host.replace(/^www\./, "");
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    ),
  ).slice(0, 8);

  let difficultyScore: number | null = null;
  if (topDomains.length) {
    const strong = topDomains.filter((d) => STRONG_DOMAINS.some((s) => d.includes(s))).length;
    difficultyScore = Math.min(100, 25 + Math.round((strong / topDomains.length) * 65));
  } else {
    notes.push("تعذّر قراءة نتائج البحث الحيّة الآن، فلا تقدير للصعوبة (بدون تخمين).");
  }

  notes.push("مؤشرات الطلب والصعوبة تقديرية من مصادر مجانية، وليست أرقام حجم بحث من أداة مدفوعة.");

  return {
    keyword: seed,
    demandScore,
    suggestionDepth,
    autocompleted,
    difficultyScore,
    topDomains,
    wikipediaMonthlyViews: wiki?.monthlyViews ?? null,
    wikipediaArticle: wiki?.article ?? null,
    notes,
  };
}
