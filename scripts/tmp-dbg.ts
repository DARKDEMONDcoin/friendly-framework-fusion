const q="تأمين سيارات أونلاين";
const ua={"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36","accept-language":"ar,en;q=0.8"};
const r=await fetch(`https://searx.be/search?q=${encodeURIComponent(q)}&format=json&language=ar`,{headers:ua});
const t=await r.text(); console.log("searx.be",r.status,t.slice(0,200));
const r2=await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=ar`,{headers:ua});
const h=await r2.text(); console.log("bing algo count",(h.match(/b_algo/g)||[]).length, (h.match(/u=a1/g)||[]).length);
