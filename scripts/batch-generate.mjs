import { GoogleGenerativeAI } from "@google/generative-ai";
import Parser from "rss-parser";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import satori from "satori";
import sharp from "sharp";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// ===== Font Loader =====
async function loadFont() {
  const fontUrl = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&display=swap";
  const cssRes = await fetch(fontUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:woff2|truetype)['"]\)/);
  if (!match) throw new Error("Could not find font URL");
  const fontRes = await fetch(match[1]);
  return Buffer.from(await fontRes.arrayBuffer());
}

// ===== OG Image Generator =====
async function generateOgImage(title, slug, fontData, outputDir) {
  let fontSize = 52;
  if (title.length > 40) fontSize = 36;
  else if (title.length > 30) fontSize = 42;
  else if (title.length > 20) fontSize = 48;

  const svg = await satori(
    {
      type: "div",
      props: {
        style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "linear-gradient(135deg, #0c1222 0%, #0f172a 40%, #1e293b 100%)", padding: "60px 80px", position: "relative" },
        children: [
          { type: "div", props: { style: { position: "absolute", top: "-60px", right: "-60px", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.3) 0%, transparent 70%)" } } },
          { type: "div", props: { style: { position: "absolute", bottom: "-40px", left: "-40px", width: "250px", height: "250px", borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 70%)" } } },
          { type: "div", props: { style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }, children: [{ type: "div", props: { style: { fontSize: "22px", color: "#0ea5e9", fontWeight: 700, letterSpacing: "0.05em" }, children: "🚀 AIトレンド速報" } }] } },
          { type: "div", props: { style: { width: "80px", height: "4px", background: "linear-gradient(90deg, #0ea5e9, #38bdf8)", borderRadius: "2px", marginBottom: "24px" } } },
          { type: "div", props: { style: { fontSize: `${fontSize}px`, fontWeight: 700, color: "#f1f5f9", textAlign: "center", lineHeight: 1.4, maxWidth: "1040px", wordBreak: "keep-all", overflowWrap: "break-word" }, children: title } },
          { type: "div", props: { style: { position: "absolute", bottom: "0", left: "0", right: "0", height: "6px", background: "linear-gradient(90deg, #0ea5e9, #38bdf8, #0ea5e9)" } } },
        ],
      },
    },
    { width: OG_WIDTH, height: OG_HEIGHT, fonts: [{ name: "Noto Sans JP", data: fontData, weight: 700, style: "normal" }] }
  );
  const pngBuffer = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
  const outputPath = path.join(outputDir, `${slug}.png`);
  await fs.writeFile(outputPath, pngBuffer);
  return outputPath;
}

// ===== 15 different search queries for topic diversity =====
const TOPIC_QUERIES = [
  'AI エージェント 自律型 2026',
  'OpenAI GPT-5 新モデル 2026',
  'Google Gemini 最新 アップデート 2026',
  'Claude Anthropic 最新 2026',
  'AI 画像生成 Midjourney Stable Diffusion 最新',
  'AI 動画生成 Sora Runway 2026',
  'AI プログラミング Copilot Cursor Devin',
  'AI 医療 ヘルスケア 診断 2026',
  'AI 規制 EU法 日本 ガイドライン 2026',
  'AI ロボット ヒューマノイド 2026',
  'AI 音声合成 音楽生成 Suno 2026',
  'Apple AI Intelligence 最新 2026',
  'AI スタートアップ 資金調達 ユニコーン 2026',
  'AI 教育 学習 EdTech 2026',
  'AI セキュリティ サイバー攻撃 ディープフェイク 2026',
];

// ===== Date helpers =====
function getDateForIndex(index) {
  // index 0 -> March 16, ..., index 14 -> March 30
  const baseDate = new Date(2026, 2, 16); // March 16, 2026
  baseDate.setDate(baseDate.getDate() + index);
  return baseDate;
}

function formatDateForFrontmatter(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

// ===== Get existing titles to avoid duplicates =====
async function getExistingTitles(blogDir) {
  try {
    const files = await fs.readdir(blogDir);
    const titles = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(blogDir, file), 'utf-8');
      const m = content.match(/title:\s*["']([^"']+)["']/);
      if (m) titles.push(m[1]);
    }
    return titles;
  } catch { return []; }
}

// ===== Sleep helper =====
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== Main =====
async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error("Error: GEMINI_API_KEY not set"); process.exit(1); }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const parser = new Parser();

  const blogDir = path.resolve(__dirname, "..", "src", "content", "blog");
  const ogDir = path.resolve(__dirname, "..", "public", "og");
  await fs.mkdir(blogDir, { recursive: true });
  await fs.mkdir(ogDir, { recursive: true });

  console.log("📦 Loading font...");
  const fontData = await loadFont();
  console.log("✅ Font loaded\n");

  const TOTAL = 15;
  let successCount = 0;

  for (let i = 0; i < TOTAL; i++) {
    const articleNum = i + 1;
    const pubDate = getDateForIndex(i);
    const formattedDate = formatDateForFrontmatter(pubDate);
    const query = TOPIC_QUERIES[i];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📝 Article ${articleNum}/${TOTAL} | Date: ${formattedDate} | Query: ${query}`);
    console.log('='.repeat(60));

    try {
      // Fetch news for this topic
      const queryStr = encodeURIComponent(query);
      const feed = await parser.parseURL(`https://news.google.com/rss/search?q=${queryStr}&hl=ja&gl=JP&ceid=JP:ja`);
      const topNews = feed.items.slice(0, 10).map((item, idx) => `${idx+1}. ${item.title} (${item.pubDate})`).join("\n");
      console.log(`📰 Headlines:\n${topNews.substring(0, 500)}\n`);

      // Get existing titles to prevent duplicates
      const existingTitles = await getExistingTitles(blogDir);
      let duplicateGuard = '';
      if (existingTitles.length > 0) {
        duplicateGuard = `\n\n### DUPLICATE PREVENTION (CRITICAL):\nThese topics are ALREADY written. Pick a DIFFERENT one:\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`;
      }

      const prompt = `
You are an expert AI researcher and tech blog writer.
Below are trending AI news headlines in Japan:

${topNews}

CRITICAL: Choose ONE headline and write a high-quality, in-depth Japanese news blog post about it.
The article MUST be about REAL, CURRENT events from 2026. Do NOT write about old 2024/2025 news.
${duplicateGuard}

Output MUST be valid Markdown with YAML frontmatter. Do NOT wrap in \`\`\`markdown.
Start immediately with frontmatter:
---
title: "[Catchy clickable title about the topic]"
description: "[SEO description, 120-160 chars, with primary keyword]"
pubDate: "${formattedDate}"
tags: ["タグ1", "タグ2"]  # 2-4 keywords
---

### STRUCTURE:
1. Opening hook (2-3 compelling sentences)
2. 4-5 H2 sections (300+ words each)
3. H3 sub-sections where appropriate
4. Min 2000 Japanese characters
5. Bold for key terms, bullet points for clarity
6. End with forward-looking perspective

### WRITING STYLE (ANTI-AI):
1. Conversational, enthusiastic Japanese tech blogger tone
2. NEVER use: "結論から言うと", "〜について解説します", "いかがでしたか？", "この記事では〜を紹介しました", "まとめ"
3. Include personal opinions: "実際に触ってみて…", "個人的にはここが神機能"
4. Varied paragraph lengths, natural bolding
5. Mix short punchy + longer analytical sentences
6. Specific numbers and dates for credibility

### CTA (MANDATORY - at end):
## 🔗 関連ツール・サービス
List 2-4 real AI tools/services with **[Name](real URL)** — 一行説明
`;

      console.log("🤖 Generating with Gemini...");
      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();

      // Clean markdown wrapper
      if (text.startsWith("```markdown")) text = text.substring(13, text.length - 3).trim();
      else if (text.startsWith("```")) text = text.substring(3, text.length - 3).trim();

      // Force correct pubDate
      text = text.replace(/pubDate:\s*["'][^"']+["']/, `pubDate: '${formattedDate}'`);

      // Extract title for slug
      const titleMatch = text.match(/title:\s*["']([^"']+)["']/);
      let slug = `ai-news-${Date.now()}`;
      if (titleMatch?.[1]) {
        let s = titleMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        if (s) slug = s.substring(0, 50) + `-${Date.now().toString().slice(-4)}`;
      }

      // Generate OG image
      console.log("🎨 Generating OG image...");
      const articleTitle = titleMatch ? titleMatch[1] : slug;
      await generateOgImage(articleTitle, slug, fontData, ogDir);
      console.log(`  ✅ OG: public/og/${slug}.png`);

      // Add heroImage to frontmatter (pointing to public/og for static serving)
      // For the blog, we reference it from the public directory
      text = text.replace(
        /^(---\n[\s\S]*?)(---)/,
        (match, front, end) => front + `heroImage: "/og/${slug}.png"\n` + end
      );

      // Write article
      const filePath = path.join(blogDir, `${slug}.md`);
      await fs.writeFile(filePath, text, "utf-8");
      console.log(`  ✅ Article saved: ${slug}.md`);
      successCount++;

    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    }

    // Rate limit protection: wait 5 seconds between API calls
    if (i < TOTAL - 1) {
      console.log("  ⏳ Waiting 5s before next article...");
      await sleep(5000);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 Batch complete! ${successCount}/${TOTAL} articles generated.`);
  console.log('='.repeat(60));
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
