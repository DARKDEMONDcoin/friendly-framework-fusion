const q="تأمين سيارات أونلاين";
const urls=[
 ["brave",`https://search.brave.com/search?q=${encodeURIComponent(q)}`],
 ["bing",`https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=ar`],
 ["ddg",`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}&kl=xa-ar`],
 ["mojeek",`https://www.mojeek.com/search?q=${encodeURIComponent(q)}`],
 ["startpage",`https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}`],
 ["searx.be",`https://searx.be/search?q=${encodeURIComponent(q)}&format=json`],
 ["tiekoetter",`https://searx.tiekoetter.com/search?q=${encodeURIComponent(q)}&format=json`],
 ["ecosia",`https://www.ecosia.org/search?q=${encodeURIComponent(q)}`],
 ["marginalia",`https://search.marginalia.nu/search?query=${encodeURIComponent(q)}`],
];
console.log(await Promise.all(urls.map(async ([n,u])=>{try{const r=await fetch(u!,{headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36","accept-language":"ar,en;q=0.8"},signal:AbortSignal.timeout(8000)});const t=await r.text();return `${n}:${r.status}:${t.length}`}catch(e){return `${n}:ERR:${(e as Error).message}`}})));
