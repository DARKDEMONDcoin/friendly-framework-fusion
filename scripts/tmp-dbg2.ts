const q="تأمين سيارات أونلاين";
const ua={"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36","accept-language":"ar,en;q=0.8"};
const h=await (await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=ar`,{headers:ua})).text();
const i=h.indexOf("b_algo"); console.log(JSON.stringify(h.slice(i-40,i+600)));
