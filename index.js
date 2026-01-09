import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// Renderer-Endpoint auf Railway
const RENDERER_URL = "https://renderer-production-925a.up.railway.app/render";

// Cache-Zeit in Sekunden
const CACHE_TTL = 300;

app.use("*", cors());

// Hilfsfunktion für Textnormalisierung (Umlaute, Sonderzeichen, Plural)
function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Entferne diakritische Zeichen
    .replace(/[^a-z0-9\s]/g, ""); // Entferne Sonderzeichen
}

app.get("/", c => {
  return c.html(`
    <html>
      <head>
        <title>Jobsuche</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 2rem; background:#fafafa; }
          h1 { color: #ff6600; }
          form { margin-bottom: 1rem; }
          input, button { padding: .6rem; margin-right:.5rem; font-size:1rem; }
          .job { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: .8rem; }
          .job h3 { margin: 0 0 .3rem; color: #ff6600; }
          .job p { margin: .2rem 0; }
          a { color: #0077cc; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>Jobsuche</h1>
        <form method="GET" action="/api">
          <input name="term" placeholder="Suchbegriff (z. B. Ergo, Physio, Leitung)" />
          <button type="submit">Suchen</button>
          <button type="submit" name="refresh" value="1">Refresh</button>
        </form>
        <p>Verwende die API direkt über <code>/api?term=Ergotherapeut</code></p>
      </body>
    </html>
  `);
});

// Haupt-API-Endpunkt
app.get("/api", async c => {
  const term = c.req.query("term") || "";
  const refresh = c.req.query("refresh") === "1";
  const cacheKey = `ntg-jobs-${term.toLowerCase()}`;
  const cache = caches.default;

  // Cache prüfen
  if (!refresh) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const data = await cached.json();
      data.cached = true;
      return c.json(data);
    }
  }

  const targetUrl = "https://novotergum.de/karriere/offene-stellenangebote/?_search=" + encodeURIComponent(term);

  // Rendern über Railway
  const renderRes = await fetch(`${RENDERER_URL}?url=${encodeURIComponent(targetUrl)}`);
  const html = await renderRes.text();

  // DOM simulieren (einfache Variante)
  const jobCards = html.match(/<a[^>]+class="personio-job-card"[\s\S]+?<\/a>/g) || [];

  let jobs = jobCards.map(card => {
    const get = (regex) => {
      const match = card.match(regex);
      return match ? match[1].trim() : "";
    };
    return {
      title: get(/<h3[^>]*>(.*?)<\/h3>/),
      location: get(/<p[^>]*class="job-location"[^>]*>(.*?)<\/p>/),
      salary: get(/<p[^>]*class="job-salary"[^>]*>(.*?)<\/p>/),
      link: get(/href="([^"]+)"/)
    };
  });

  // Filtern nach Suchbegriff
  if (term && term.trim() !== "") {
    const lcTerm = normalize(term);
    jobs = jobs.filter(job =>
      normalize(job.title).includes(lcTerm) ||
      normalize(job.location).includes(lcTerm)
    );
  }

  const result = {
    cached: false,
    term,
    count: jobs.length,
    jobs
  };

  // Cache speichern
  c.executionCtx.waitUntil(
    cache.put(cacheKey, new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      expirationTtl: CACHE_TTL
    }))
  );

  return c.json(result);
});

export default app;
