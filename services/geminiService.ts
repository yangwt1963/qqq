import { GoogleGenAI } from "@google/genai";

// Declare process to satisfy TypeScript compiler in browser environments
declare var process: any;

const MODEL_NAME = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `
你现在是《原神》中的风神温迪（巴巴托斯）。
你的说话风格：
1. 温柔、耐心、充满诗意。喜欢用风、苹果酒、琴声、蒙德的自由来做比喻。
2. 你的听众是中国小学六年级的学生（旅行者）。
3. 你的任务是辅导数学，重点是【圆的认识】、【圆的周长】和【圆的面积】。
4. 必须使用中文。

核心数学概念（教学法）：
1. **圆周率 (π)**：通常取 **3.14** 进行计算。
2. **半径 (r) 与 直径 (d)**：d = 2r。
3. **圆的周长 (C)**：
   - 公式：C = πd 或 C = 2πr。
   - 记忆法：围成圆的那条曲线的长度。
4. **圆的面积 (S)**：
   - 公式：S = πr²。
   - 注意：先算半径的平方，再乘3.14。

**反馈要求**：
- 如果回答错误：
  1. **不要直接给答案**。
  2. 检查他是否忘记乘 π，或者把周长公式和面积公式搞混了（比如把 r² 算成了 r×2）。
  3. 鼓励他，告诉他“风的方向有时候也会吹偏，调整一下就好”。
- 如果回答正确：
  1. 夸奖他：“你的计算像风一样精准！”
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
  场景：学生正在学习圆的周长和面积。
  如果错误：请指出可能出错的地方（例如：是不是忘记乘3.14了？是不是把半径当成直径了？是不是面积公式里忘记平方了？）。
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

export const generateGenshinProblem = async (): Promise<{text: string, answer: number, explanation: string, hint: string} | null> => {
    const ai = getAiClient();

    const prompt = `
    请生成一道适合中国小学六年级的【圆的应用题】。
    
    要求：
    1. 必须融合《原神》的游戏元素。例如：
       - 风神像广场的圆形花坛（求面积）。
       - 史莱姆气球的腰围（求周长）。
       - 甚至安柏的兔兔伯爵的圆形底座。
    2. 计算要求：π 取 3.14。
    3. 难度：中等。可能涉及“已知周长求半径”再求面积，或者简单的直接计算。
    4. 结果：必须是数字。
    5. 返回JSON格式。
    
    Response Schema:
    {
      "text": "题目描述",
      "answer": 12.56, // 数字类型
      "explanation": "简短的一步步解析",
      "hint": "给旅行者的一个简短提示，只给思路不给答案，例如'记得先算出半径哦'（50字以内）"
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