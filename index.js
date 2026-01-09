import express from "express";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/render", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send("Missing URL parameter: ?url=https://example.com");
  }

  try {
    console.log(`[Renderer] Fetching: ${targetUrl}`);

    const browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true
    });

    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60000 });
    const html = await page.content();
    await browser.close();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("[Renderer] Error:", err);
    res.status(500).send("Render error: " + err.message);
  }
});

app.get("/", (req, res) => {
  res.send("Renderer online. Beispiel: /render?url=https://novotergum.de");
});

app.listen(PORT, () => {
  console.log(`[Renderer] Server running on port ${PORT}`);
});
