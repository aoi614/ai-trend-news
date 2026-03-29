import fs from "fs";
import path from "path";

const blogDir = "src/content/blog";
const files = fs.readdirSync(blogDir).filter(f => f.endsWith(".md"));

for (const file of files) {
  const slug = file.replace(/\.md$/, "");
  const ogPath = path.join("src/assets/og", slug + ".png");
  if (!fs.existsSync(ogPath)) { console.log("No OG for", file); continue; }
  const content = fs.readFileSync(path.join(blogDir, file), "utf-8");
  if (content.includes("heroImage:")) { console.log("Already has heroImage:", file); continue; }
  const updated = content.replace(/^(---\n[\s\S]*?)(---)/,
    (match, front, end) => front + 'heroImage: "../../assets/og/' + slug + '.png"\n' + end
  );
  fs.writeFileSync(path.join(blogDir, file), updated, "utf-8");
  console.log("Updated:", file);
}
