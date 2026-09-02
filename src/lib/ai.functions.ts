import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSkill } from "@/data/skills";
import { freeChat, gatherEvidence, planResearch } from "@/lib/nour-research.server";

/** الموظفون الذين يعتمدون على بحث حقيقي قبل الإجابة. */
const RESEARCH_EMPLOYEES = new Set(["nour"]);

/** يجمع أدلة حقيقية مجانية (اقتراحات بحث، نتائج SERP، تحليل صفحات، Search Console). */
async function researchFor(
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

const evidenceRules = [
  "استخدم كتلة «أدلة ميدانية» أدناه كمصدر وحيد للأرقام والمنافسين والكلمات — لا تخترع بيانات غيرها.",
  "اذكر مصدر كل رقم مهم (Search Console، اقتراحات البحث، نتائج البحث، تحليل الصفحة).",
  "إن كانت الأدلة ناقصة، قل ذلك صراحة واقترح ما يلزم لجمعها.",
].join("\n");

const personas: Record<string, { name: string; role: string; channel: string; kind: string }> = {
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

type Deliverable = {
  title?: string;
  kind?: string;
  channel?: string;
  body?: string;
  scheduled?: string;
};

const input = z.object({
  workspaceId: z.string().uuid(),
  employeeId: z.string().min(1),
  message: z.string().min(1).max(4000),
});

export const askEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) throw new Error("مفتاح خدمة الذكاء الاصطناعي غير مهيأ.");

    const supabase = context.supabase;
    const persona = personas[data.employeeId];
    if (!persona) throw new Error("موظف غير معروف.");

    const [{ data: workspace }, { data: brain }, { data: history }] = await Promise.all([
      supabase.from("workspaces").select("*").eq("id", data.workspaceId).maybeSingle(),
      supabase.from("brain_items").select("title, body, kind").eq("workspace_id", data.workspaceId),
      supabase
        .from("messages")
        .select("role, body")
        .eq("workspace_id", data.workspaceId)
        .eq("employee_id", data.employeeId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    if (!workspace) throw new Error("مساحة العمل غير موجودة.");

    const { error: insertUserError } = await supabase.from("messages").insert({
      workspace_id: data.workspaceId,
      employee_id: data.employeeId,
      role: "user",
      body: data.message,
    });
    if (insertUserError) throw new Error(insertUserError.message);

    const brainText = (brain ?? [])
      .map((b) => `- [${b.kind}] ${b.title}${b.body ? `: ${b.body}` : ""}`)
      .join("\n");

    const research = await researchFor(
      data.employeeId,
      apiKey,
      { name: workspace.name, industry: workspace.industry },
      data.message,
      data.workspaceId,
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
      "أجب دائماً بالعربية وبإيجاز عملي.",
      'أعد ردك بصيغة JSON فقط بالشكل: {"reply": "نص ردك للمستخدم", "deliverable": {"title": "عنوان المخرج", "kind": "نوع المخرج", "channel": "المنصة", "body": "نص المخرج الجاهز", "scheduled": "متى يُنفّذ"} }',
      'إن لم يطلب المستخدم مخرجاً جاهزاً للنشر أو الإرسال، اجعل "deliverable" القيمة null.',
      `المنصة الافتراضية لك هي ${persona.channel} ونوع مخرجك الشائع ${persona.kind}.`,
    ]
      .filter(Boolean)
      .join("\n");

    const priorMessages = (history ?? [])
      .slice()
      .reverse()
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.body }));

    const raw = await freeChat(apiKey, [
      { role: "system", content: system },
      ...priorMessages,
      { role: "user", content: data.message },
    ]);

    let reply = raw;
    let deliverable: Deliverable | null = null;

    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned) as { reply?: string; deliverable?: Deliverable | null };
      if (parsed.reply) reply = parsed.reply;
      deliverable = parsed.deliverable ?? null;
    } catch {
      deliverable = null;
    }

    if (research.used.length) {
      reply = `${reply.trim()}\n\n— استندتُ إلى بيانات حقيقية: ${research.used.join(" · ")}`;
    }

    const { data: assistantRow, error: assistantError } = await supabase
      .from("messages")
      .insert({
        workspace_id: data.workspaceId,
        employee_id: data.employeeId,
        role: "assistant",
        body: reply,
      })
      .select()
      .single();
    if (assistantError) throw new Error(assistantError.message);

    let createdTaskId: string | null = null;
    if (deliverable?.title && deliverable.body) {
      const { data: task } = await supabase
        .from("tasks")
        .insert({
          workspace_id: data.workspaceId,
          employee_id: data.employeeId,
          title: deliverable.title,
          detail: reply.slice(0, 400),
          kind: deliverable.kind ?? persona.kind,
          channel: deliverable.channel ?? persona.channel,
          status: "review",
          output: deliverable.body,
          scheduled: deliverable.scheduled ?? "بانتظار اعتمادك",
          steps: [
            { label: "فهم الطلب", state: "done" },
            { label: "التنفيذ", state: "done" },
            { label: "مراجعتك", state: "active" },
            { label: "النشر", state: "todo" },
          ],
        })
        .select("id")
        .single();
      createdTaskId = task?.id ?? null;
    }

    return { reply, messageId: assistantRow.id, createdTaskId };
  });

const skillInput = z.object({
  workspaceId: z.string().uuid(),
  employeeId: z.string().min(1),
  skillId: z.string().min(1),
  values: z.record(z.string(), z.string()),
});

/** تشغيل قدرة محددة: يخرج مخرجاً جاهزاً ويحفظه كمهمة بانتظار الاعتماد. */
export const runSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => skillInput.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) throw new Error("مفتاح خدمة الذكاء الاصطناعي غير مهيأ.");

    const persona = personas[data.employeeId];
    const skill = getSkill(data.skillId);
    if (!persona || !skill || skill.employeeId !== data.employeeId)
      throw new Error("قدرة غير معروفة لهذا الموظف.");

    const supabase = context.supabase;
    const [{ data: workspace }, { data: brain }] = await Promise.all([
      supabase.from("workspaces").select("*").eq("id", data.workspaceId).maybeSingle(),
      supabase.from("brain_items").select("title, body, kind").eq("workspace_id", data.workspaceId),
    ]);
    if (!workspace) throw new Error("مساحة العمل غير موجودة.");

    const brainText = (brain ?? [])
      .map((b) => `- [${b.kind}] ${b.title}${b.body ? `: ${b.body}` : ""}`)
      .join("\n");

    const system = [
      `أنت ${persona.name}، ${persona.role}`,
      `تعمل داخل منصة «سهل» لصالح العلامة: ${workspace.name} (${workspace.industry}).`,
      `نبرة العلامة: ${workspace.tone}.`,
      workspace.banned_words?.length
        ? `كلمات ممنوعة تماماً: ${workspace.banned_words.join("، ")}.`
        : "",
      brainText ? `معرفة العلامة:\n${brainText}` : "",
      "أنت تنفّذ الآن مهمة محددة وتسلّم مخرجاً نهائياً جاهزاً للاستخدام — لا أسئلة ولا مقدمات ولا اعتذارات.",
      "اكتب بالعربية الفصحى الواضحة، بصيغة Markdown منسّقة، والتزم حرفياً بالهيكل المطلوب.",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = skill.buildPrompt(data.values);

    const requestSummary = Object.entries(data.values)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `${k}: ${v['length'] > 120 ? `${v.slice(0, 120)}…` : v}`)
      .join(" · ");

    await supabase.from("messages").insert({
      workspace_id: data.workspaceId,
      employee_id: data.employeeId,
      role: "user",
      body: `▸ ${skill.title}${requestSummary ? `\n${requestSummary}` : ""}`,
    });

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "z-ai/glm-5.2:free",
        models: [
          "z-ai/glm-5.2:free",
          "google/gemini-2.0-flash-exp:free",
          "meta-llama/llama-3.3-70b-instruct:free",
        ],
        route: "fallback",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("تجاوزت حد الاستخدام مؤقتاً — حاول بعد قليل.");
    if (res.status === 402) throw new Error("رصيد الذكاء الاصطناعي غير كافٍ — أضف رصيداً للمتابعة.");
    if (!res.ok) throw new Error(`تعذّر تنفيذ المهمة (${res.status}).`);

    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const output = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!output) throw new Error("لم يصل مخرج من الموظف — أعد المحاولة.");

    const { data: assistantRow, error: assistantError } = await supabase
      .from("messages")
      .insert({
        workspace_id: data.workspaceId,
        employee_id: data.employeeId,
        role: "assistant",
        body: output,
      })
      .select()
      .single();
    if (assistantError) throw new Error(assistantError.message);

    const { data: task } = await supabase
      .from("tasks")
      .insert({
        workspace_id: data.workspaceId,
        employee_id: data.employeeId,
        title: `${skill.title}${data.values['keyword'] ? ` — ${data.values['keyword']}` : data.values['topic'] ? ` — ${data.values['topic']}` : ""}`,
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

    return { output, messageId: assistantRow.id, taskId: task?.id ?? null };
  });
