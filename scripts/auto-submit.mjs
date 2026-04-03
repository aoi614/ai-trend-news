#!/usr/bin/env node
/**
 * auto-submit.mjs
 * 新記事を各種プラットフォームに自動投稿・通知するスクリプト
 *
 * 機能:
 *   1. IndexNow (Bing/Yandex/Naver) — インデックス即時通知
 *   2. Google Ping — サイトマップ更新Ping
 *   3. はてなブックマーク — セルフブックマーク用URL生成
 *   4. 各種ソーシャル投稿URL生成
 *
 * 使い方:
 *   node scripts/auto-submit.mjs [article-slug]
 *   → slugを引数で渡すか、最新記事を自動検出
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.resolve(__dirname, "..", "src", "content", "blog");
const SITE_URL = "https://ai-trend-news.com";
const INDEXNOW_KEY = "85bdf649e1b0e9c0694db7b03e9a7a88";

// === ユーティリティ ===
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };
  const frontmatter = {};
  match[1].split("\n").forEach(line => {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      let val = rest.join(":").trim();
      val = val.replace(/^["']|["']$/g, "");
      frontmatter[key.trim()] = val;
    }
  });
  return { frontmatter, body: content.slice(match[0].length).trim() };
}

// === 1. IndexNow: Bing/Yandex/Naverに即座にインデックス通知 ===
async function submitIndexNow(urls) {
  const engines = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
    "https://yandex.com/indexnow",
  ];

  const payload = JSON.stringify({
    host: "ai-trend-news.com",
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  });

  console.log("\n📡 IndexNow: Bing/Yandex/Naverへ送信中...");
  
  for (const engine of engines) {
    try {
      const res = await fetch(engine, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: payload,
      });
      const engineName = new URL(engine).hostname;
      if (res.ok || res.status === 200 || res.status === 202) {
        console.log(`  ✅ ${engineName}: 成功 (${res.status})`);
      } else {
        console.log(`  ⚠️ ${engineName}: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      const engineName = new URL(engine).hostname;
      console.log(`  ❌ ${engineName}: ${e.message}`);
    }
  }
}

// === 2. Google/Bing Sitemap Ping ===
async function pingSitemaps() {
  const sitemapUrl = `${SITE_URL}/sitemap-index.xml`;
  const pingUrls = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ];

  console.log("\n🔔 Sitemap Ping送信中...");
  
  for (const pingUrl of pingUrls) {
    try {
      const res = await fetch(pingUrl);
      const host = new URL(pingUrl).hostname;
      if (res.ok) {
        console.log(`  ✅ ${host}: Ping成功`);
      } else {
        console.log(`  ⚠️ ${host}: ${res.status}`);
      }
    } catch (e) {
      console.log(`  ❌ ${new URL(pingUrl).hostname}: ${e.message}`);
    }
  }
}

// === 3. ソーシャルメディア投稿URL生成 ===
function generateSocialUrls(articleUrl, title) {
  const encoded = encodeURIComponent(articleUrl);
  const encodedTitle = encodeURIComponent(title);
  
  return {
    hatena: `https://b.hatena.ne.jp/entry/panel/?url=${encoded}`,
    hatenaAdd: `https://b.hatena.ne.jp/add?mode=confirm&url=${encoded}&title=${encodedTitle}`,
    twitter: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
    pocket: `https://getpocket.com/save?url=${encoded}&title=${encodedTitle}`,
    reddit: `https://www.reddit.com/submit?url=${encoded}&title=${encodedTitle}`,
    hackernews: `https://news.ycombinator.com/submitlink?u=${encoded}&t=${encodedTitle}`,
    line: `https://line.me/R/share?text=${encodedTitle}%0A${encoded}`,
  };
}

// === 4. はてなブックマーク自動エントリー通知 ===
async function notifyHatena(articleUrl) {
  // はてなブックマークのエントリー情報APIでクロール促進
  const apiUrl = `https://b.hatena.ne.jp/entry/jsonlite/?url=${encodeURIComponent(articleUrl)}`;
  console.log("\n🔖 はてなブックマーク: エントリー登録確認中...");
  try {
    const res = await fetch(apiUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.count !== undefined) {
        console.log(`  ✅ はてブ登録済み: ${data.count}ブックマーク`);
      } else {
        console.log(`  📝 はてブ未登録 → セルフブックマークを推奨`);
      }
    }
  } catch (e) {
    console.log(`  ⚠️ はてブ確認スキップ: ${e.message}`);
  }
}

// === メイン処理 ===
async function main() {
  const slugArg = process.argv[2];
  let targetSlug, title;

  if (slugArg) {
    targetSlug = slugArg;
    const filePath = path.join(blogDir, `${slugArg}.md`);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const { frontmatter } = parseFrontmatter(content);
      title = frontmatter.title || slugArg;
    } catch {
      title = slugArg;
    }
  } else {
    // 最新記事を自動検出
    const files = (await fs.readdir(blogDir))
      .filter(f => f.endsWith(".md") && !f.includes("weekly-digest"))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      console.error("❌ 記事が見つかりません");
      process.exit(1);
    }

    const latestFile = files[0];
    targetSlug = latestFile.replace(/\.md$/, "");
    const content = await fs.readFile(path.join(blogDir, latestFile), "utf-8");
    const { frontmatter } = parseFrontmatter(content);
    title = frontmatter.title || targetSlug;
  }

  const articleUrl = `${SITE_URL}/blog/${targetSlug}/`;

  console.log("🚀 ========================");
  console.log("   自動リンク投稿ツール");
  console.log("🚀 ========================");
  console.log(`\n📰 対象記事: ${title}`);
  console.log(`🔗 URL: ${articleUrl}`);

  // 1. IndexNow送信
  await submitIndexNow([
    articleUrl,
    `${SITE_URL}/`,
    `${SITE_URL}/blog/`,
    `${SITE_URL}/sitemap-index.xml`,
  ]);

  // 2. Sitemap Ping
  await pingSitemaps();

  // 3. はてブ確認
  await notifyHatena(articleUrl);

  // 4. ソーシャルURL生成
  const socialUrls = generateSocialUrls(articleUrl, title);
  
  console.log("\n📋 ワンクリック投稿リンク（ブラウザで開いて投稿）:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  🔖 はてブ:     ${socialUrls.hatenaAdd}`);
  console.log(`  🐦 Twitter/X:  ${socialUrls.twitter}`);
  console.log(`  📘 Facebook:   ${socialUrls.facebook}`);
  console.log(`  💼 LinkedIn:   ${socialUrls.linkedin}`);
  console.log(`  📱 LINE:       ${socialUrls.line}`);
  console.log(`  📌 Pocket:     ${socialUrls.pocket}`);
  console.log(`  🔴 Reddit:     ${socialUrls.reddit}`);
  console.log(`  🟠 Hacker News: ${socialUrls.hackernews}`);

  console.log("\n✨ 完了！検索エンジンへの通知とソーシャルリンクの生成が完了しました。");
  console.log("   上記リンクをブラウザで開くと、各プラットフォームに投稿できます。\n");
}

main().catch(console.error);
