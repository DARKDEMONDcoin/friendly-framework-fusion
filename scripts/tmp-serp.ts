import { serpSearch } from "@/lib/seo-research.server";
for (const q of ["تأمين سيارات أونلاين","أفضل كوفي شوب في الرياض"]) {
  const t=Date.now();
  const r = await serpSearch(q);
  console.log(q, "->", r.length, ((Date.now()-t)/1000).toFixed(1)+"s", r.slice(0,3).map(x=>x.url).join(" | "));
}
