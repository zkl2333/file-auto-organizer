import OpenAI from "openai";
import { config } from "./config.js";

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
  baseURL: config.OPENAI_BASE_URL || undefined,
});

export async function aiClassify(
  fileName: string,
  description: string,
  knownDirs: string[]
): Promise<string> {
  const sections: string[] = [];
  if (knownDirs.length > 0) {
    const dirsList = knownDirs.join("\n");
    sections.push(`已有目录(相对根目录, 每行一个):\n${dirsList}`);
  }
  sections.push(`文件名: ${fileName}`);
  const desc = (description || "").trim();
  if (desc) {
    sections.push(`描述: ${desc}`);
  }
  const prompt = `${sections.join(
    "\n\n"
  )}\n\n请输出最合适的最接近的目录路径(相对根目录)，当没有合适的分类的时候应当新建目录。\n只输出路径, 不要任何解释。`;

  const res = await openai.chat.completions.create({
    model: config.OPENAI_MODEL,
    messages: [
      { role: "system", content: "你是一个文件分类助手" },
      { role: "user", content: prompt },
    ],
  });

  return (res.choices?.[0]?.message?.content || "").trim();
}
