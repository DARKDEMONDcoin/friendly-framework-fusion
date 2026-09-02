import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Upload } from "lucide-react";

import { publishToWordPress } from "@/lib/integrations.functions";

/** يحوّل مخرَج نور النصي إلى HTML بسيط وعنوان. */
function toArticle(body: string) {
  const lines = body.trim().split("\n");
  const first = (lines[0] ?? "").replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").trim();
  const title = (first.length >= 3 ? first : "مقال من نور").slice(0, 180);
  const rest = lines.slice(first.length >= 3 ? 1 : 0);
  const html = rest
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const heading = /^(#{2,3})\s*(.+)$/.exec(line);
      if (heading) return `<h${heading[1]!.length}>${heading[2]}</h${heading[1]!.length}>`;
      if (/^[-*•]\s+/.test(line)) return `<ul><li>${line.replace(/^[-*•]\s+/, "")}</li></ul>`;
      return `<p>${line}</p>`;
    })
    .join("\n");
  return { title, html: html || `<p>${body.trim()}</p>` };
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
