import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `
你现在是《原神》中的风神温迪（巴巴托斯）。
你的说话风格：
1. 充满诗意，喜欢用风、自由、苹果酒、蒲公英作为比喻。
2. 语气轻松愉快，偶尔会“诶嘿”。
3. 你的听众是中国小学六年级的学生（旅行者）。
4. 你的任务是辅导数学，特别是分数的乘除法。
5. 必须使用中文。

请根据用户的输入提供简短、鼓励性的反馈或详细的数学分析。
如果是解释错误，请一步步拆解分数乘除法的步骤。
分数乘法口诀：分子乘分子，分母乘分母，能约分的要约分。
分数除法口诀：除以一个数，等于乘以这个数的倒数。
`;

// Lazy initialization to prevent "process is not defined" errors during module load
let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (aiClient) return aiClient;
  
  // Safe access to process.env
  let apiKey = '';
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      apiKey = process.env.API_KEY;
    }
  } catch (e) {
    // Ignore error if process is not defined
    console.warn("Could not access process.env");
  }

  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
};

export const getVentiFeedback = async (
  question: string,
  userAnswer: string,
  correctAnswer: string,
  isCorrect: boolean
): Promise<string> => {
  const ai = getAiClient();
  // We can't easily check api key presence on the instance, so we check the env safely again or just try
  // If the key is empty, the API call will fail gracefully.

  const prompt = `
  题目：${question}
  正确答案：${correctAnswer}
  旅行者的答案：${userAnswer}
  结果：${isCorrect ? "正确" : "错误"}

  请以温迪的身份给出反馈。
  如果正确：给出充满风元素的简短夸奖（30字以内）。
  如果错误：先安慰旅行者，然后用简单易懂的方式分析为什么错了，指出计算的关键步骤（150字以内）。
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

export const generateGenshinProblem = async (): Promise<{text: string, answerNumerator: number, answerDenominator: number, explanation: string} | null> => {
    const ai = getAiClient();

    const prompt = `
    请生成一道适合中国小学六年级的【分数乘法】或【分数除法】应用题。
    
    要求：
    1. 必须融合《原神》的游戏元素（例如：蒙德、璃月、温迪、派蒙、迪卢克、日落果、史莱姆、原石）。
    2. 题目描述要有趣，像游戏任务。
    3. 难度：简单到中等。
    4. 结果必须是一个分数（如果是整数，看作分母为1）。
    5. 返回JSON格式。
    
    Response Schema:
    {
      "text": "题目描述",
      "answerNumerator": 整数分子,
      "answerDenominator": 整数分母,
      "explanation": "简短的一步步解析"
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