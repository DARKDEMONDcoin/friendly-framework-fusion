/**
 * نواة تشغيل الموظفين على الخادم: الشخصيات، جمع الأدلة الحقيقية، وتنفيذ قدرة كاملة.
 * تُستخدم من دالة الخادم `runSkill` (بطلب المستخدم) ومن الجدولة التلقائية (cron)
 * بنفس المنطق تماماً حتى تكون مخرجات نور متطابقة في الحالتين.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { getSkill } from "@/data/skills";
import { freeChat, gatherEvidence, planResearch } from "./nour-research.server";
import { memoryBlock } from "./memory.server";

export type Client = SupabaseClient<Database>;

/** الموظفون الذين يعتمدون على بحث حقيقي قبل الإجابة. */
export const RESEARCH_EMPLOYEES = new Set(["nour"]);

export const evidenceRules = [
  "استخدم كتلة «أدلة ميدانية» أدناه كمصدر وحيد للأرقام والمنافسين والكلمات — لا تخترع بيانات غيرها.",
  "اذكر مصدر كل رقم مهم (Search Console، اقتراحات البحث، نتائج البحث، تحليل الصفحة).",
  "إن كانت الأدلة ناقصة، قل ذلك صراحة واقترح ما يلزم لجمعها.",
].join("\n");

export const personas: Record<
  string,
  { name: string; role: string; channel: string; kind: string }
> = {
  sonny: {
    name: "سِراج",
    role: "مدير السوشيال ميديا — يخطط المحتوى، يكتب المنشورات، ويجدول النشر.",
    channel: "instagram",
    kind: "منشور",
  },
  eva: {
    name: "أمَل",
    role: "المساعدة التنفيذية — تفرز البريد، ترتّب المواعيد، وتكتب الردود.",
    channel: "gmail",
    kind: "رد بريد",
  },
  sam: {
    name: "سالم",
    role: "مسؤول المبيعات — يبحث عن العملاء المحتملين ويكتب تسلسلات التواصل.",
    channel: "linkedin",
    kind: "رسالة تواصل",
  },
  nour: {
    name: "نور",
    role: [
      "استراتيجية محتوى وسيو عربي بخبرة 12 عاماً في أسواق الخليج ومصر والشام.",
      "تملك المنظومة كاملة: بحث الكلمات وتجميعها دلالياً، تحليل نتائج البحث وفجوة المنافسين، الخرائط الموضوعية،",
      "كتابة المقالات وصفحات الهبوط وصفحات المقارنة والسيو البرمجي، الروابط الداخلية والبيانات المنظمة،",
      "التدقيق التقني العربي (RTL و hreflang والخطوط والفهرسة)، كشف تعارض الصفحات ورادار تراجع المحتوى،",
      "رفع نسبة النقر من بيانات Search Console، الظهور في مساعدات الذكاء الاصطناعي (GEO/AEO)، والسيو المحلي وخرائط جوجل.",
      "منهجك: قرار قبل كتابة، ودليل قبل ادعاء، ورقم يقيس كل مخرج.",
      "تكتب عربية بشرية بلا حشو ولا ترجمة آلية، وتطبّع الرسم العربي (أ/إ/ا، ة/ه، ي/ى) وتفرّق بين الفصحى المكتوبة واللهجة المبحوث بها.",
      "لا تخترع أرقاماً ولا مصادر ولا بيانات ترتيب؛ إن غابت البيانات صرّحت بأن التقدير مبني على أنماط القطاع.",
    ].join(" "),
    channel: "wordpress",
    kind: "مقال",
  },
  dana: {
    name: "دانة",
    role: "المصممة — أفكار بصرية ونصوص إعلانية للتصاميم.",
    channel: "canva",
    kind: "تصميم",
  },
  adam: {
    name: "آدم",
    role: "محلل البيانات — تقارير أداء وتوصيات رقمية.",
    channel: "analytics",
    kind: "تقرير",
  },
};

/** يجمع أدلة حقيقية مجانية (اقتراحات بحث، نتائج SERP، تحليل صفحات، Search Console، GA4). */
export async function researchFor(
  employeeId: string,
  apiKey: string,
  brand: { name: string; industry: string },
  message: string,
  workspaceId: string,
): Promise<{ block: string; used: string[] }> {
  if (!RESEARCH_EMPLOYEES.has(employeeId)) return { block: "", used: [] };
  try {
    const plan = await planResearch(apiKey, brand, message);
    if (
      !plan.keywords?.length &&
      !plan.searches?.length &&
      !plan.urls?.length &&
      !plan.useSearchConsole
    ) {
      return { block: "", used: [] };
    }
    const evidence = await gatherEvidence(plan, workspaceId);
    return { block: evidence.block, used: evidence.used };
  } catch (error) {
    console.error("[nour] research failed:", error);
    return { block: "", used: [] };
  }
}

export type SkillRun = {
  output: string;
  messageId: string | null;
  taskId: string | null;
  title: string;
  channel: string;
};

/**
 * تنفيذ قدرة محددة كاملة: بحث حقيقي → مخرج نهائي → رسالة في المحادثة → مهمة بانتظار الاعتماد.
 * يعمل مع عميل المستخدم (RLS) أو عميل الخادم (cron) بنفس السلوك.
 */
export async function executeSkill(
  client: Client,
  params: {
    workspaceId: string;
    employeeId: string;
    skillId: string;
    values: Record<string, string>;
    /** يُضاف إلى عنوان المهمة للتمييز بين التشغيل اليدوي والمجدول. */
    origin?: string;
  },
): Promise<SkillRun> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("مفتاح OpenRouter غير مهيأ.");

  const persona = personas[params.employeeId];
  const skill = getSkill(params.skillId);
  if (!persona || !skill || skill.employeeId !== params.employeeId)
    throw new Error("قدرة غير معروفة لهذا الموظف.");

  const [{ data: workspace }, { data: brain }] = await Promise.all([
    client.from("workspaces").select("*").eq("id", params.workspaceId).maybeSingle(),
    client.from("brain_items").select("title, body, kind").eq("workspace_id", params.workspaceId),
  ]);
  if (!workspace) throw new Error("مساحة العمل غير موجودة.");

  const prompt = skill.buildPrompt(params.values);

  const requestSummary = Object.entries(params.values)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}: ${v.length > 120 ? `${v.slice(0, 120)}…` : v}`)
    .join(" · ");

  const brainText = memoryBlock(brain ?? [], `${skill.title} ${requestSummary}`, 8);

  const research = await researchFor(
    params.employeeId,
    apiKey,
    { name: workspace.name, industry: workspace.industry },
    `${skill.title}\n${requestSummary}`,
    params.workspaceId,
  );

  const system = [
    `أنت ${persona.name}، ${persona.role}`,
    `تعمل داخل منصة «سهل» لصالح العلامة: ${workspace.name} (${workspace.industry}).`,
    `نبرة العلامة: ${workspace.tone}.`,
    workspace.banned_words?.length
      ? `كلمات ممنوعة تماماً: ${workspace.banned_words.join("، ")}.`
      : "",
    brainText ? `معرفة العلامة:\n${brainText}` : "",
    research.block ? `${evidenceRules}\n\n## أدلة ميدانية (لحظية)\n${research.block}` : "",
    "أنت تنفّذ الآن مهمة محددة وتسلّم مخرجاً نهائياً جاهزاً للاستخدام — لا أسئلة ولا مقدمات ولا اعتذارات.",
    "اكتب بالعربية الفصحى الواضحة، بصيغة Markdown منسّقة، والتزم حرفياً بالهيكل المطلوب.",
  ]
    .filter(Boolean)
    .join("\n");

  await client.from("messages").insert({
    workspace_id: params.workspaceId,
    employee_id: params.employeeId,
    role: "user",
    body: `▸ ${skill.title}${params.origin ? ` (${params.origin})` : ""}${requestSummary ? `\n${requestSummary}` : ""}`,
  });

  let output = (
    await freeChat(apiKey, [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ])
  ).trim();
  if (!output) throw new Error("لم يصل مخرج من الموظف — أعد المحاولة.");
  if (research.used.length) {
    output = `${output}\n\n> مصادر البيانات: ${research.used.join(" · ")}`;
  }

  const { data: assistantRow, error: assistantError } = await client
    .from("messages")
    .insert({
      workspace_id: params.workspaceId,
      employee_id: params.employeeId,
      role: "assistant",
      body: output,
    })
    .select("id")
    .single();
  if (assistantError) throw new Error(assistantError.message);

  const subject = params.values["keyword"] || params.values["topic"] || "";
  const title = `${skill.title}${subject ? ` — ${subject}` : ""}${params.origin ? ` · ${params.origin}` : ""}`;

  const { data: task } = await client
    .from("tasks")
    .insert({
      workspace_id: params.workspaceId,
      employee_id: params.employeeId,
      title,
      detail: requestSummary.slice(0, 400),
      kind: skill.kind,
      channel: skill.channel,
      status: "review",
      output,
      scheduled: "بانتظار اعتمادك",
      steps: [
        { label: "فهم الطلب", state: "done" },
        { label: "التنفيذ", state: "done" },
        { label: "مراجعتك", state: "active" },
        { label: "النشر", state: "todo" },
      ],
    })
    .select("id")
    .single();

  return {
    output,
    messageId: assistantRow?.id ?? null,
    taskId: task?.id ?? null,
    title,
    channel: skill.channel,
  };
}
