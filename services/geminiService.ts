import { GoogleGenAI } from "@google/genai";

// Declare process to satisfy TypeScript compiler in browser environments
declare var process: any;

const MODEL_NAME = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `
你现在是《原神》中的风神温迪（巴巴托斯）。
你的说话风格：
1. 温柔、耐心、充满诗意。喜欢用风、苹果酒、琴声、蒙德的自由来做比喻。
2. 语气轻松，但因为这次**学生在课堂上完全没听懂“比”的概念，感到很挫败**，所以你要格外细心，多给鼓励。
3. 你的听众是中国小学六年级的学生（旅行者）。
4. 你的任务是辅导数学，重点是【比的意义】、【化简比】和【求比值】。
5. 必须使用中文。

核心数学概念（教学法）：
1. **比 (Ratio)**：两个数相除又叫做两个数的比。
2. **前项 (Antecedent) 与 后项 (Consequent)**：比号前面的数和后面的数。
3. **比的基本性质**：比的前项和后项同时乘或除以相同的数（0除外），比值不变。
4. **化简比 (Simplification)**：结果必须是“最简整数比”（互质）。
   - 方法：找到最大公因数 (GCD)，两边同时除以它。
   - 如果是分数/小数，先化成整数，再化简。
5. **求比值 (Value of Ratio)**：前项 ÷ 后项，结果是一个数（整数、小数或分数）。

**反馈要求**：
- 如果回答错误：
  1. **不要直接给答案**。
  2. 先安抚情绪：“没关系，课堂上太快了，我们慢慢来。”
  3. **必须详细拆解步骤**。
     - 比如化简比：先问“前项和后项的最大公因数是谁？”，演示除法过程。
- 如果回答正确：
  1. 给予极大的肯定，夸奖他掌握了风的韵律。
`;

// Lazy initialization
let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (aiClient) return aiClient;
  
  // Initialize strictly according to guidelines using process.env.API_KEY
  aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return aiClient;
};

export const getVentiFeedback = async (
  question: string,
  userAnswer: string,
  correctAnswer: string,
  isCorrect: boolean
): Promise<string> => {
  const ai = getAiClient();
  
  const prompt = `
  题目：${question}
  正确答案：${correctAnswer}
  旅行者的答案：${userAnswer}
  结果：${isCorrect ? "正确" : "错误"}

  请以温迪的身份给出反馈。
  场景：学生可能混淆了“化简比”（结果是比，如 2:3）和“求比值”（结果是数，如 2/3）。
  如果错误：请一步步引导，像教怎么弹琴一样细致，指出具体是哪一步计算（比如找公因数）出了问题。
  字数限制：200字以内。
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      }
    });
    return response.text || "风带来了一点杂音... (AI响应为空)";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "哎嘿？好像与天空岛的连接中断了。不过别担心，数学的真理是不会变的！";
  }
};

export const generateGenshinProblem = async (): Promise<{text: string, answer: string, explanation: string, hint: string} | null> => {
    const ai = getAiClient();

    const prompt = `
    请生成一道适合中国小学六年级的【比的应用题】。
    
    要求：
    1. 必须融合《原神》的游戏元素。例如：
       - 炼金合成：日落果与树莓的比例。
       - 队伍搭配：火元素角色与水元素角色的比例。
       - 甚至派蒙吃的史莱姆料理比例。
    2. 题目背景：帮助旅行者解决实际问题。
    3. 难度：中等。可能涉及“按比例分配”或者“已知比和其中一个量求另一个量”。
    4. 结果格式：如果结果是比，格式为 "a:b"；如果结果是具体数量，就是数字。
    5. 返回JSON格式。
    
    Response Schema:
    {
      "text": "题目描述",
      "answer": "答案字符串",
      "explanation": "简短的一步步解析",
      "hint": "给旅行者的一个简短提示，只给思路不给答案，像温迪的低语（50字以内）"
    }
    `;

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            responseMimeType: "application/json"
        }
      });
      
      const text = response.text;
      if (!text) return null;
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to generate problem", e);
      return null;
    }
}