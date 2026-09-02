import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { freeChat } from "@/lib/nour-research.server";
import {
  evidenceRules,
  executeSkill,
  personas,
  researchFor,
} from "@/lib/nour-run.server";


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
    if (!apiKey) throw new Error("مفتاح OpenRouter غير مهيأ.");

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

    const { memoryBlock } = await import("./memory.server");
    const brainText = memoryBlock(brain ?? [], data.message, 8);

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
    if (!apiKey) throw new Error("مفتاح OpenRouter غير مهيأ.");

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

    const prompt = skill.buildPrompt(data.values);

    const requestSummary = Object.entries(data.values)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `${k}: ${v['length'] > 120 ? `${v.slice(0, 120)}…` : v}`)
      .join(" · ");

    const { memoryBlock } = await import("./memory.server");
    const brainText = memoryBlock(brain ?? [], `${skill.title} ${requestSummary}`, 8);

    const research = await researchFor(
      data.employeeId,
      apiKey,
      { name: workspace.name, industry: workspace.industry },
      `${skill.title}\n${requestSummary}`,
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
      "أنت تنفّذ الآن مهمة محددة وتسلّم مخرجاً نهائياً جاهزاً للاستخدام — لا أسئلة ولا مقدمات ولا اعتذارات.",
      "اكتب بالعربية الفصحى الواضحة، بصيغة Markdown منسّقة، والتزم حرفياً بالهيكل المطلوب.",
    ]
      .filter(Boolean)
      .join("\n");

    await supabase.from("messages").insert({
      workspace_id: data.workspaceId,
      employee_id: data.employeeId,
      role: "user",
      body: `▸ ${skill.title}${requestSummary ? `\n${requestSummary}` : ""}`,
    });

    let output = (await freeChat(apiKey, [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ])).trim();
    if (!output) throw new Error("لم يصل مخرج من الموظف — أعد المحاولة.");
    if (research.used.length) {
      output = `${output}\n\n> مصادر البيانات: ${research.used.join(" · ")}`;
    }

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
