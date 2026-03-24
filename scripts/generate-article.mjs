import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Load environment variables correctly
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateArticle() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set in the environment variables.");
    process.exit(1);
  }

  // Initialize the Gemini AI client
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are an expert AI researcher and tech blog writer specializing in Artificial Intelligence. 
    Write a high-quality, engaging, and highly informative blog post introducing the "latest AI tools", "recent AI news", or "AI learning tips".
    Choose ONE specific AI topic for this article (e.g., a new AI image generator, an update to ChatGPT/Claude, or how AI is changing a specific industry) to make it deep and interesting.
    
    The output MUST be exactly in valid Markdown format suitable for an Astro framework blog.
    Do not wrap the whole response in a markdown code block (\`\`\`markdown \`\`\`). Starts immediately with the frontmatter.
    Include the following YAML frontmatter at the very top of the file:
    ---
    title: "[A Catchy, Clickable Title about the AI topic]"
    description: "[A short 1-2 sentence compelling SEO description about the AI tool/news]"
    pubDate: "YYYY-MM-DD"
    heroImage: "/blog-placeholder-about.jpg"
    ---
    
    Then write a well-structured article with an introduction, 3-4 main headings (H2), subheadings (H3), bullet points, and code snippets or examples if applicable.
    
    ### CRITICAL WRITING STYLE RULES (ANTI-AI DETECTION):
    1. WRITE LIKE A HUMAN TECH BLOGGER. Use a conversational, enthusiastic, and slightly informal tone in Japanese (Desu/Masu form, but natural).
    2. NEVER use typical robotic AI phrases like "結論から言うと", "〜について解説します", "いかがでしたか？", "この記事では〜を紹介しました", "最後に", "まとめ", or "AI言語モデルとして".
    3. Include "personal opinions" or simulated hands-on experiences (e.g., "実際に触ってみて驚いたのは…", "個人的にはここが神機能だと思いました").
    4. Do not make the structure perfectly symmetric. Real humans write with varying paragraph lengths and use bolding (**) naturally for emphasis, not just on every keyword.
    5. Do not write a generic dictionary-style explanation. Write it as a "Hot News/Review" column.
    
    Make it highly readable, optimized for SEO, and extremely valuable.
  `;

  try {
    console.log("Generating article with Gemini API...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up if the AI wrapped the response in a markdown code block by mistake
    text = text.trim();
    if (text.startsWith("\`\`\`markdown")) {
      text = text.substring(13, text.length - 3).trim();
    } else if (text.startsWith("\`\`\`")) {
      text = text.substring(3, text.length - 3).trim();
    }

    // Replace the pubDate in the frontmatter with today's date
    const today = new Date();
    // format as Jan 01 2024
    const formattedDate = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
    
    text = text.replace(/pubDate:\s*["'][^"']+["']/, `pubDate: '${formattedDate}'`);

    // Extract title from frontmatter to create a filename
    const titleMatch = text.match(/title:\s*["']([^"']+)["']/);
    let filename = `auto-generated-${Date.now()}.md`;
    
    if (titleMatch && titleMatch[1]) {
      // Create a URL-friendly slug from the title
      let slug = titleMatch[1]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      if (slug) {
        // Truncate if slug is too long
        slug = slug.substring(0, 50);
        filename = `${slug}-${Date.now().toString().slice(-4)}.md`;
      }
    }

    // Define the output directory based on Astro's content collections
    const blogDir = path.resolve(__dirname, "..", "src", "content", "blog");
    
    // Ensure the blog directory exists
    await fs.mkdir(blogDir, { recursive: true });
    
    const filePath = path.join(blogDir, filename);
    
    // Write the Markdown file
    await fs.writeFile(filePath, text, "utf-8");
    console.log(`✅ Successfully created new article: ${filePath}`);
    
  } catch (error) {
    console.error("Error generating article:", error);
    process.exit(1);
  }
}

generateArticle();
