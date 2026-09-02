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

/** توسيع الكلمة المفتاحية: الاقتراح المباشر + أسئلة (كيف/ما/أفضل/سعر/أين) — مجاني. */
export async function keywordExpansion(seed: string): Promise<{
  seed: string;
  suggestions: string[];
  questions: string[];
}> {
  const modifiers = ["كيف", "ما هو", "أفضل", "سعر", "أين", "مقارنة"];
  const [base, bing, ...mods] = await Promise.all([
    googleSuggest(seed),
    bingSuggest(seed),
    ...modifiers.map((m) => googleSuggest(`${m} ${seed}`)),
  ]);
  const all = [...base, ...bing, ...mods.flat()];
  const unique = Array.from(new Set(all.map((s) => s.trim()).filter(Boolean)));
  const questions = unique.filter((s) => /^(كيف|ما|هل|أين|لماذا|متى|من)\b/.test(s));
  return {
    seed,
    suggestions: unique.filter((s) => !questions.includes(s)).slice(0, 30),
    questions: questions.slice(0, 20),
  };
}

export type SerpResult = { rank: number; title: string; url: string; snippet: string };

/** نتائج بحث حقيقية عبر DuckDuckGo HTML (مجاني، بلا مفتاح). */
export async function serpSearch(query: string, region = "xa-ar"): Promise<SerpResult[]> {
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept-Language": "ar,en;q=0.8",
      },
      body: new URLSearchParams({ q: query, kl: region }),
      signal: timeout(12_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: SerpResult[] = [];
    const blockRe =
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]*class="[^"]*result__a|<\/div>\s*<\/div>\s*<\/div>|$)/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(html)) && results.length < 10) {
      let href = decodeEntities(m[1] ?? "");
      const uddg = /[?&]uddg=([^&]+)/.exec(href);
      if (uddg?.[1]) href = decodeURIComponent(uddg[1]);
      if (!/^https?:\/\//.test(href)) continue;
      const snippetMatch = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(m[3] ?? "");
      results.push({
        rank: results.length + 1,
        title: strip(m[2] ?? "").slice(0, 200),
        url: href,
        snippet: strip(snippetMatch?.[1] ?? "").slice(0, 300),
      });
    }
    return results;
  } catch {
    return [];
  }
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
