const RENDERER_URL = "https://renderer-production-925.up.railway.app/render";
const TTL_SECONDS = 600; // 10 Minuten Cache

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // === FRONTEND ===
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(renderHTML(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // === API ===
    if (url.pathname === "/api") {
      const term = (url.searchParams.get("term") || "Ergotherapeut").trim();
      const refresh = url.searchParams.get("refresh") === "1";

      const cacheKey = `ntg-jobs-${term.toLowerCase()}`;
      let data = !refresh ? await env.CACHE?.get(cacheKey, "json") : null;

      if (!data) {
        data = await fetchJobs(term);
        await env.CACHE?.put(cacheKey, JSON.stringify(data), { expirationTtl: TTL_SECONDS });
      } else {
        data.cached = true;
      }

      return new Response(JSON.stringify(data, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

async function fetchJobs(term) {
  const target = `https://novotergum.de/karriere/offene-stellenangebote/?_search=${encodeURIComponent(term)}`;
  const html = await fetch(`${RENDERER_URL}?url=${encodeURIComponent(target)}`).then(r => r.text());
  const jobs = extractJobs(html);
  return { cached: false, term, count: jobs.length, jobs };
}

function extractJobs(html) {
  const jobs = [];
  const cards = html.match(/<a[^>]+class="[^"]*personio-job-card[^"]*"[^>]*>/g) || [];
  for (const c of cards) {
    const get = name => (c.match(new RegExp(`${name}="([^"]*)"`)) || [])[1];
    const title = get("data-name");
    const loc = get("data-office");
    const sched = get("data-schedule");
    const salary = get("data-salary");
    const href = get("href");
    if (title && href)
      jobs.push({
        title,
        location: [loc, sched].filter(Boolean).join(" – "),
        salary,
        link: href,
      });
  }
  return jobs;
}

function renderHTML() {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>NOVOTERGUM Jobfinder</title>
<style>
body{font-family:sans-serif;background:#fafafa;margin:2rem;color:#222}
h1{color:#ff6c00}
input,button{padding:.6rem 1rem;font-size:1rem;border-radius:6px}
input{border:1px solid #ccc;width:260px}
button{background:#ff6c00;color:white;border:none;margin-left:.4rem;cursor:pointer}
button:hover{background:#e55d00}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;margin-top:1.5rem}
.card{background:white;border-radius:8px;padding:1rem;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.card h3{color:#ff6c00;margin-bottom:.3rem}
.card p{margin:.2rem 0}
a{color:#0066cc;text-decoration:none;font-weight:500}
</style>
</head>
<body>
<h1>NOVOTERGUM Jobfinder</h1>
<input id="term" placeholder="Ergotherapeut, Physiotherapeut, Logopäde...">
<button onclick="load()">Suchen</button>
<div id="result"></div>
<script>
async function load(){
  const term=document.getElementById('term').value||'Ergotherapeut';
  const r=document.getElementById('result');
  r.innerHTML='Lade...';
  const res=await fetch('/api?term='+encodeURIComponent(term)+'&refresh=1');
  const data=await res.json();
  if(!data.jobs?.length){r.innerHTML='<p>Keine Ergebnisse.</p>';return;}
  r.innerHTML='<div class="grid">'+data.jobs.map(j=>'<div class="card"><h3>'+j.title+'</h3><p>'+j.location+'</p><p>'+j.salary+'</p><a href="'+j.link+'" target="_blank">Details ansehen</a></div>').join('')+'</div>';
}
load();
</script>
</body></html>`;
}
