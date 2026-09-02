import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Upload } from "lucide-react";

import { publishToWordPress } from "@/lib/integrations.functions";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** تنسيق داخل السطر: **عريض** و*مائل* و[نص](رابط). */
function inline(text: string) {
  return esc(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)\*([^*]+)\*/g, "$1<em>$2</em>");
}

/** يحوّل مخرَج نور (Markdown) إلى HTML نظيف صالح للنشر + عنوان. */
function toArticle(body: string) {
  const lines = body.trim().split("\n");
  const first = (lines[0] ?? "").replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").trim();
  const hasTitle = first.length >= 3;
  const title = (hasTitle ? first : "مقال من نور").slice(0, 180);

  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };

  for (const raw of lines.slice(hasTitle ? 1 : 0)) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    const heading = /^(#{2,4})\s*(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      continue;
    }
    const bullet = /^[-*•]\s+(.+)$/.exec(line);
    if (bullet) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inline(bullet[1]!)}</li>`);
      continue;
    }
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (numbered) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inline(numbered[1]!)}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();

  const html = out.join("\n");
  return { title, html: html || `<p>${inline(body.trim())}</p>` };
}

export function PublishToWordPress({
  workspaceId,
  body,
}: {
  workspaceId: string;
  body: string;
}) {
  const qc = useQueryClient();
  const publish = useServerFn(publishToWordPress);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => {
      const { title, html } = toArticle(body);
      return publish({ data: { workspaceId, title, content: html, status: "draft" } });
    },
    onSuccess: (r) => {
      setLink(r.link ?? "");
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر الإرسال"),
  });

  if (link !== null) {
    return (
      <p className="mt-2 flex items-center gap-2 text-xs font-bold text-jade-deep">
        <Check className="size-3.5" /> حُفظت مسودة على ووردبريس
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="underline">
            افتح المسودة
          </a>
        ) : null}
      </p>
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => {
          setError(null);
          send.mutate();
        }}
        disabled={send.isPending}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary disabled:opacity-60"
      >
        {send.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        أرسل كمسودة إلى ووردبريس
      </button>
      {error ? <p className="mt-1.5 text-xs font-semibold text-coral">{error}</p> : null}
    </div>
  );
}
