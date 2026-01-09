export default {
  async fetch(request) {
    const { pathname, searchParams } = new URL(request.url);

    if (pathname === "/" || pathname.endsWith("/index.html")) {
      return new Response(renderHTML(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (pathname.startsWith("/api")) {
      const term = searchParams.get("term")?.trim() || "Ergotherapeut";
      const data = await getJobs(term);
      return new Response(JSON.stringify(data, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

// ---- API-Logik ----

const RENDERER_URL = "https://renderer-production-925.up.railway.app/render";
const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function getJobs(term) {
  const cacheKey = term.toLowerCase();
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { cached: true, ...cached.data };
  }

  const targetUrl = `https://novotergum.de/karriere/offene-stellenangebote/?_search=${encodeURIComponent(term)}`;
  const html = await fetch(`${RENDERER_URL}?url=${encodeURIComponent(targetUrl)}`).then(r => r.text());
  const jobs = extractJobs(html);
  const data = { term, count: jobs.length, jobs };
  CACHE.set(cacheKey, { data, timestamp: Date.now() });
  return { cached: false, ...data };
}

function extractJobs(html) {
  const results = [];
  const jobBlocks = html.match(/<div[^>]*class="[^"]*personio-job-card[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g);
  if (!jobBlocks) return results;

  for (const block of jobBlocks) {
    const titleMatch = block.match(/<h3[^>]*>(.*?)<\/h3>/);
    const title = titleMatch ? clean(titleMatch[1]) : null;

    const locationMatch = block.match(/<p[^>]*class="job-location"[^>]*>(.*?)<\/p>/);
    const location = locationMatch ? clean(locationMatch[1]) : null;

    const salaryMatch = block.match(/<p[^>]*class="job-salary"[^>]*>(.*?)<\/p>/);
    const salary = salaryMatch ? clean(salaryMatch[1].replace(/Gehalt:\s*/i, "")) : null;

    const linkMatch = block.match(/href="(https:\/\/novotergum\.de\/jobs\/[^"]+)"/);
    const link = linkMatch ? linkMatch[1] : null;

    if (title && link) results.push({ title, location, salary, link });
  }

  return results;
}

function clean(str) {
  return str.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// ---- Frontend HTML ----

function renderHTML() {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>NOVOTERGUM Jobsuche</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background:#fafafa; color:#222; }
    h1 { color:#ff6c00; }
    input { padding:0.5rem 1rem; font-size:1rem; width:300px; border:1px solid #ccc; border-radius:6px; }
    button { background:#ff6c00; color:white; border:none; padding:0.6rem 1rem; border-radius:6px; cursor:pointer; }
    button:hover { background:#e55d00; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1rem; margin-top:1.5rem; }
    .card { background:white; border-radius:10px; padding:1rem; box-shadow:0 1px 3px rgba(0,0,0,0.1); transition:0.2s; }
    .card:hover { box-shadow:0 4px 10px rgba(0,0,0,0.15); }
    .title { font-weight:600; color:#ff6c00; margin-bottom:0.3rem; }
    .loc, .salary { font-size:0.9rem; color:#555; }
    .salary { margin-top:0.2rem; }
    .link { display:inline-block; margin-top:0.6rem; text-decoration:none; color:#0066cc; font-weight:500; }
  </style>
</head>
<body>
  <h1>Jobfinder NOVOTERGUM</h1>
  <div>
    <input id="term" placeholder="z. B. Ergotherapeut, Physiotherapeut..." />
    <button onclick="loadJobs()">Suchen</button>
  </div>
  <div id="result"></div>

  <script>
    async function loadJobs() {
      const term = document.getElementById('term').value || 'Ergotherapeut';
      const box = document.getElementById('result');
      box.innerHTML = '<p>Lade Jobs...</p>';
      const res = await fetch('/api?term=' + encodeURIComponent(term));
      const data = await res.json();
      if (!data.jobs?.length) {
        box.innerHTML = '<p>Keine Ergebnisse gefunden.</p>';
        return;
      }
      box.innerHTML = '<div class="grid">' + data.jobs.map(j => 
        '<div class="card">' +
          '<div class="title">' + j.title + '</div>' +
          '<div class="loc">' + (j.location || '') + '</div>' +
          (j.salary ? '<div class="salary">' + j.salary + '</div>' : '') +
          '<a class="link" href="' + j.link + '" target="_blank">Details ansehen</a>' +
        '</div>'
      ).join('') + '</div>';
    }

    loadJobs();
  </script>
</body>
</html>`;
}
