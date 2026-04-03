#!/usr/bin/env node
/**
 * cleanup-articles.mjs
 * 既存記事からAI臭いフレーズを一括で除去・置換するスクリプト
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.resolve(__dirname, "..", "src", "content", "blog");

// AI臭いフレーズとその置換先のマッピング
const replacements = [
  // 読者への呼びかけ系
  [/皆さん、/g, ""],
  [/皆さんは/g, ""],
  [/皆さんも/g, ""],
  [/ありますよね。/g, "あります。"],
  [/ですよね。/g, "です。"],
  [/ではないでしょうか。/g, "だろう。"],
  [/ではないでしょうか？/g, "ではないか。"],
  [/いかがでしたか？/g, ""],
  [/いかがでしたでしょうか。/g, ""],
  
  // テレビ司会者系
  [/飛び込んできました！/g, "報じられた。"],
  [/飛び込んできました。/g, "報じられた。"],
  [/一筋の光を差し込むような/g, "注目すべき"],
  [/まさに/g, ""],
  [/〜に注目です！/g, "に注目したい。"],
  [/に注目です！/g, "に注目したい。"],
  
  // 大袈裟な表現
  [/ゲームチェンジャー/g, "転換点"],
  [/パラダイムシフト/g, "大きな変化"],
  [/に終止符を打/g, "を変え"],
  [/真価を発揮/g, "本領を発揮"],
  [/デジタルオーケストラ/g, "デジタル連携"],
  
  // AI特有のまとめフレーズ
  [/結論から言うと、/g, ""],
  [/結論から言えば、/g, ""],
  [/この記事では〜を紹介しました。/g, ""],
  [/〜について解説します。/g, "を見ていく。"],
  [/について解説していきます。/g, "を見ていく。"],
  
  // 壊れたMarkdownリンク修正 (CTAセクション)
  [/\*\*([^[*]+)\]\(([^)]+)\)\*\*/g, "**[$1]($2)**"],
];

async function main() {
  const files = (await fs.readdir(blogDir)).filter(f => f.endsWith(".md"));
  console.log(`📝 ${files.length}件の記事をスキャン中...\n`);

  let totalFixed = 0;

  for (const file of files) {
    const filePath = path.join(blogDir, file);
    const original = await fs.readFile(filePath, "utf-8");
    let content = original;
    let fixes = 0;

    for (const [pattern, replacement] of replacements) {
      const matches = content.match(pattern);
      if (matches) {
        fixes += matches.length;
        content = content.replace(pattern, replacement);
      }
    }

    // 連続する空行を2行に制限
    content = content.replace(/\n{4,}/g, "\n\n\n");
    // 文頭の空白行を除去
    content = content.replace(/^(\s*\n)+---/, "---");

    if (content !== original) {
      await fs.writeFile(filePath, content, "utf-8");
      console.log(`  ✅ ${file} — ${fixes}箇所修正`);
      totalFixed += fixes;
    } else {
      console.log(`  ⏩ ${file} — 修正不要`);
    }
  }

  console.log(`\n🎉 完了！合計 ${totalFixed}箇所 を修正しました。`);
}

main().catch(console.error);
