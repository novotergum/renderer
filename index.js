import express from "express";
import { chromium } from "playwright";

const app = express();

app.get("/", (req, res) => res.send("OK"));

app.get("/render", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: "Missing ?url=" });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(target, { waitUntil: "networkidle" });
  const html = await page.content();

  await browser.close();
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Listening on", PORT));
