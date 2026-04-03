#!/usr/bin/env node
/**
 * cross-post.mjs
 * 最新の記事からZenn/note.com用の要約記事を自動生成する
 * 
 * 使い方:
 *   node scripts/cross-post.mjs
 *   → dist/cross-posts/ に要約Markdownが出力される
 *
 * Zennへの投稿: 出力されたmdをarticlesフォルダにコピーしてpush
 * note.comへの投稿: 出力されたテキストをnote.comのエディタに貼り付け
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.resolve(__dirname, "..", "src", "content", "blog");
const outputDir = path.resolve(__dirname, "..", "dist", "cross-posts");
const SITE_URL = "https://ai-trend-news.com";

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };
  
  const frontmatter = {};
  match[1].split("\n").forEach(line => {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      let val = rest.join(":").trim();
      // Remove quotes
      val = val.replace(/^["']|["']$/g, "");
      // Parse array
      if (val.startsWith("[")) {
        try { val = JSON.parse(val); } catch {}
      }
      frontmatter[key.trim()] = val;
    }
  });
  
  const body = content.slice(match[0].length).trim();
  return { frontmatter, body };
}

function extractTLDR(body) {
  const match = body.match(/> \*\*💡 この記事のポイント\*\*\n([\s\S]*?)(?=\n\n)/);
  if (match) {
    return match[0];
  }
  return "";
}

function extractFirstSection(body) {
  // 最初のH2セクションまでのテキストを取得
  const sections = body.split(/^## /m);
  if (sections.length >= 2) {
    const intro = sections[0].trim();
    const firstH2 = "## " + sections[1].split(/^## /m)[0].trim();
    return intro + "\n\n" + firstH2;
  }
  return body.substring(0, 800);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  
  // 最新5件の記事を取得
  const files = (await fs.readdir(blogDir))
    .filter(f => f.endsWith(".md") && !f.includes("weekly-digest"))
    .sort()
    .reverse()
    .slice(0, 5);

  console.log(`📝 最新${files.length}件の記事からクロスポスト用要約を生成\n`);

  for (const file of files) {
    const content = await fs.readFile(path.join(blogDir, file), "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);
    const slug = file.replace(/\.md$/, "");
    const articleUrl = `${SITE_URL}/blog/${slug}/`;
    
    if (!frontmatter.title) continue;
    
    const title = frontmatter.title;
    const description = frontmatter.description || "";
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    const tldr = extractTLDR(body);
    const firstSection = extractFirstSection(body);

    // === Zenn用 ===
    const zennContent = `---
title: "${title}"
emoji: "🤖"
type: "tech"
topics: [${tags.map(t => `"${t}"`).join(", ")}]
published: true
---

${tldr}

${firstSection.substring(0, 1500)}

---

📖 **この記事の続きはこちら**
👉 [${title}](${articleUrl})

*この記事は [AIトレンド速報](${SITE_URL}) からの転載です。最新のAIニュースを毎日配信しています。*
`;

    // === note.com用 ===
    const noteContent = `# ${title}

${description}

${tldr}

${firstSection.substring(0, 1200)}

---

## 📖 続きを読む

この記事の全文は下記リンクからお読みいただけます。
${articleUrl}

---

**AIトレンド速報** では、米国の最新AI関連ニュースを日本語で毎日配信中。
🔗 ${SITE_URL}
`;

    // ファイル出力
    const zennPath = path.join(outputDir, `zenn-${slug}.md`);
    const notePath = path.join(outputDir, `note-${slug}.md`);
    
    await fs.writeFile(zennPath, zennContent, "utf-8");
    await fs.writeFile(notePath, noteContent, "utf-8");
    
    console.log(`  ✅ ${title}`);
    console.log(`     Zenn: ${zennPath}`);
    console.log(`     note: ${notePath}\n`);
  }

  console.log(`\n🎉 完了！出力先: ${outputDir}`);
  console.log(`\n📋 投稿手順:`);
  console.log(`  Zenn: dist/cross-posts/zenn-*.md をZennリポジトリの articles/ にコピーしてpush`);
  console.log(`  note: dist/cross-posts/note-*.md の内容をnote.comエディタに貼り付けて公開`);
}

main().catch(console.error);
