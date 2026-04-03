#!/usr/bin/env node
/**
 * batch-generate.mjs
 * 記事を連続で複数本生成するバッチスクリプト
 */
import { execSync } from "child_process";

const COUNT = 5;
console.log(`🚀 ${COUNT}本の記事を連続生成します...\n`);

for (let i = 1; i <= COUNT; i++) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`📝 記事 ${i}/${COUNT} を生成中...`);
  console.log(`${"=".repeat(50)}\n`);
  
  try {
    execSync("node scripts/generate-article.mjs", {
      cwd: process.cwd(),
      stdio: "inherit",
      env: { ...process.env },
    });
    console.log(`\n✅ 記事 ${i}/${COUNT} 完了！`);
  } catch (err) {
    console.error(`\n❌ 記事 ${i}/${COUNT} でエラー:`, err.message);
  }
  
  // API レート制限を避けるため5秒待機
  if (i < COUNT) {
    console.log("⏳ 5秒待機...");
    execSync("sleep 5");
  }
}

console.log(`\n🎉 バッチ生成完了！`);
