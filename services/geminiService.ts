import { GoogleGenAI } from "@google/genai";

// Declare process to satisfy TypeScript compiler in browser environments
declare var process: any;

const MODEL_NAME = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `
你现在是《原神》中的风神温迪（巴巴托斯）。
你的说话风格：
1. 充满诗意，喜欢用风、圆环、苹果、蒲公英作为比喻。
2. 语气轻松愉快，偶尔会“诶嘿”。
3. 你的听众是一个中国小学六年级的学生（旅行者），**他在学校没听懂关于“圆”的知识，现在有点沮丧**。
4. 你的任务是辅导数学，特别是【圆的周长和面积】。
5. 必须使用中文。

重要数学规范：
1. **圆周率 (π) 统一取 3.14**。
2. 周长公式：C = πd 或 C = 2πr。
3. 面积公式：S = πr²。

请根据用户的输入提供简短、鼓励性的反馈。
如果是解释错误：
- 首先要温柔地安慰他（例如：“别担心，风也不是一开始就知道方向的”）。
- 然后一步步拆解计算步骤，特别是小数点的计算。
- 提醒他是否忘记了平方，或者混淆了周长和面积公式。
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
  如果正确：给出充满风元素的简短夸奖，比如称赞他的思维像风一样流畅（30字以内）。
  如果错误：先安慰因为没听懂课而难过的旅行者，然后用简单易懂的方式分析为什么错了（150字以内）。
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

export const generateGenshinProblem = async (): Promise<{text: string, answer: number, explanation: string} | null> => {
    const ai = getAiClient();

    const prompt = `
    请生成一道适合中国小学六年级的【圆的周长】或【圆的面积】应用题。
    
    要求：
    1. 必须融合《原神》的游戏元素（例如：风神像的底座、史莱姆的身体切面、迪卢克的披萨、派蒙的圆肚皮）。
    2. **题目背景设计为：帮助旅行者理解课堂上没听懂的圆。**
    3. 难度：简单到中等，数字尽量设计得方便计算（例如半径是10, 20, 或者能被3.14整除虽然不强求）。
    4. **π 取 3.14**。
    5. 结果必须是一个数字（可以是小数）。
    6. 返回JSON格式。
    
    Response Schema:
    {
      "text": "题目描述",
      "answer": 数字答案,
      "explanation": "简短的一步步解析，列出算式"
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