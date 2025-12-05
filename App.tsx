import React, { useState } from 'react';
import { GameMode, Question, GameState, FeedbackType } from './types';
import { Venti } from './components/Venti';
import { getVentiFeedback, generateGenshinProblem } from './services/geminiService';

// Helper to find GCD
const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b);
};

export default function App() {
  // --- State ---
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  
  // Input is now string to support "2:3"
  const [inputAnswer, setInputAnswer] = useState<string>('');
  
  const [ventiMessage, setVentiMessage] = useState<string>("听说你在课堂上对“比”有点晕头转向？\n没关系，风神温迪来陪你重新梳理一遍。我们不急，慢慢来。");
  const [ventiMood, setVentiMood] = useState<'happy' | 'thinking' | 'surprised' | 'neutral'>('happy');
  const [feedbackState, setFeedbackState] = useState<FeedbackType>('idle');
  const [hasUsedHint, setHasUsedHint] = useState(false);
  
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    streak: 0,
    totalAnswered: 0,
    currentQuestionIndex: 0,
    history: []
  });
  const [showRewardModal, setShowRewardModal] = useState(false);

  // --- Logic: Generate Basic Question (Practice) ---
  const generateBasicQuestion = (): Question => {
    // Type 1: Simplify Ratio (化简比) - 60% chance
    // Type 2: Value of Ratio (求比值) - 40% chance
    const isSimplify = Math.random() > 0.4;
    
    // Generate a base ratio "a : b" which is already simplified
    const baseA = Math.floor(Math.random() * 5) + 1; // 1-5
    let baseB = Math.floor(Math.random() * 8) + 1; // 1-8
    
    // Avoid 1:1 sometimes for variety, though valid
    if (baseA === baseB && Math.random() > 0.5) baseB += 1;

    // Ensure they are coprime (simplified)
    const divisor = gcd(baseA, baseB);
    const simplifiedA = baseA / divisor;
    const simplifiedB = baseB / divisor;

    // Scale them up to make the question
    const scale = Math.floor(Math.random() * 6) + 2; // multiply by 2 to 7
    const qA = simplifiedA * scale;
    const qB = simplifiedB * scale;

    const id = Date.now().toString();

    if (isSimplify) {
        return {
            id,
            type: 'calculation',
            subType: 'simplify',
            text: `化简比：${qA} : ${qB}`,
            correctAnswer: `${simplifiedA}:${simplifiedB}`,
            hint: `试着找找 ${qA} 和 ${qB} 的最大公因数（比如${scale}？），然后两边同时除以它。`
        };
    } else {
        // Value of Ratio logic...
        let vA = qA;
        let vB = qB;
        
        if (Math.random() > 0.5) {
             // Integer result
             vA = vB * (Math.floor(Math.random() * 3) + 1);
        } else {
             // Simple decimal like 0.5, 0.25, 0.2
             vB = vA * (Math.floor(Math.random() * 2) + 1) * 2; 
        }
        
        const correctVal = vA / vB;
        
        return {
            id,
            type: 'calculation',
            subType: 'value',
            text: `求比值：${vA} : ${vB}`,
            correctAnswer: correctVal, // Number for comparison
            hint: `“求比值”就是做除法哦。用前项 (${vA}) 除以后项 (${vB}) 试试看？`
        };
    }
  };

  // --- Logic: Start Game ---
  const startGame = async (selectedMode: GameMode) => {
    setMode(selectedMode);
    setGameState({
      score: 0,
      streak: 0,
      totalAnswered: 0,
      currentQuestionIndex: 0,
      history: []
    });
    setFeedbackState('idle');
    setInputAnswer('');
    setHasUsedHint(false);
    
    if (selectedMode === GameMode.PRACTICE) {
      setCurrentQuestion(generateBasicQuestion());
      setVentiMessage("来，我们先做几个深呼吸。基础是最重要的，就像蒲公英的根一样。我们先从化简比和求比值开始。");
      setVentiMood('neutral');
    } else if (selectedMode === GameMode.ADVENTURE) {
        setVentiMessage("让我看看冒险家协会有没有什么委托... 也就是“应用题”啦！(题目生成中...)");
        setFeedbackState('loading');
        const problem = await generateGenshinProblem();
        setFeedbackState('idle');
        if (problem) {
            setCurrentQuestion({
                id: Date.now().toString(),
                type: 'word',
                text: problem.text,
                correctAnswer: problem.answer, 
                explanation: problem.explanation,
                hint: problem.hint
            });
            setVentiMessage("新的委托来了！别怕，把题目多读两遍，找到里面的“比”。");
        } else {
             setVentiMessage("风神稍微打了个盹... 我们先做个基础题吧。");
             setMode(GameMode.PRACTICE);
             setCurrentQuestion(generateBasicQuestion());
        }
    }
  };

  // --- Logic: Submit Answer ---
  const handleSubmit = async () => {
    if (!currentQuestion) return;

    // Normalize Input: replace Chinese colon with English colon, remove spaces
    const cleanInput = inputAnswer.replace(/：/g, ':').replace(/\s/g, '');

    if (!cleanInput) return;

    setFeedbackState('loading');
    setVentiMessage("嗯... 让风神仔细看看你的思路...");
    setVentiMood('thinking');

    let isCorrect = false;

    // Check Logic
    if (currentQuestion.type === 'calculation' && currentQuestion.subType === 'simplify') {
        // String comparison "2:3" vs "2:3"
        isCorrect = cleanInput === currentQuestion.correctAnswer;
    } else {
        // Number comparison (Value of Ratio) OR Word problem result
        if (typeof currentQuestion.correctAnswer === 'number') {
            const val = parseFloat(cleanInput);
            if (!isNaN(val)) {
                isCorrect = Math.abs(val - currentQuestion.correctAnswer) < 0.01;
            }
        } else {
            isCorrect = cleanInput === String(currentQuestion.correctAnswer).replace(/\s/g, '');
        }
    }

    // Update Stats
    const newStreak = isCorrect ? gameState.streak + 1 : 0;
    setGameState(prev => ({
      ...prev,
      score: isCorrect ? prev.score + 10 : prev.score,
      streak: newStreak,
      totalAnswered: prev.totalAnswered + 1,
      history: [...prev.history, { questionId: currentQuestion.id, isCorrect }]
    }));

    // Reward
    if (isCorrect && newStreak > 0 && newStreak % 5 === 0) {
        setShowRewardModal(true);
    }

    // Context for AI
    let contextQuestion = currentQuestion.text;
    
    // AI Feedback
    if (!isCorrect || currentQuestion.type === 'word') {
         const feedback = await getVentiFeedback(
             contextQuestion, 
             cleanInput, 
             currentQuestion.correctAnswer.toString(), 
             isCorrect
         );
         setVentiMessage(feedback);
    } else {
         const praises = [
             "太棒了！这次你做得很对！",
             "看吧，只要找到了规律，比也没有那么难！",
             "就像风琴的弦一样精准！就是这个比例！"
         ];
         setVentiMessage(praises[Math.floor(Math.random() * praises.length)]);
    }

    setVentiMood(isCorrect ? 'happy' : 'surprised');
    setFeedbackState(isCorrect ? 'correct' : 'incorrect');
  };

  // --- Logic: Show Hint ---
  const handleShowHint = () => {
      if (!currentQuestion || !currentQuestion.hint) return;
      setVentiMood('thinking');
      setVentiMessage(`(悄悄话) ${currentQuestion.hint}`);
      setHasUsedHint(true);
  };

  // --- Logic: Next Question ---
  const handleNext = async () => {
    setInputAnswer('');
    setFeedbackState('idle');
    setVentiMood('neutral');
    setHasUsedHint(false);

    if (mode === GameMode.PRACTICE) {
       setCurrentQuestion(generateBasicQuestion());
       setVentiMessage("准备好了吗？下一道题乘风而来咯！");
    } else if (mode === GameMode.ADVENTURE) {
        setVentiMessage("正在寻找下一个委托...");
        setFeedbackState('loading');
        const problem = await generateGenshinProblem();
        setFeedbackState('idle');
        if (problem) {
            setCurrentQuestion({
                id: Date.now().toString(),
                type: 'word',
                text: problem.text,
                correctAnswer: problem.answer,
                explanation: problem.explanation,
                hint: problem.hint
            });
            setVentiMessage("这是关于提瓦特生活的问题哦。");
        } else {
            setMode(GameMode.PRACTICE);
            setCurrentQuestion(generateBasicQuestion());
        }
    }
  };

  // --- Render: Intro / Menu ---
  if (mode === GameMode.MENU) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-4xl w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border-4 border-anemo-200">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold text-anemo-600 mb-4 tracking-wider">温迪的比例歌谣</h1>
            <p className="text-xl text-gray-600">Traveler's Ratio Ballad</p>
            <p className="text-md text-anemo-500 mt-2 font-bold">~ 献给在课堂上被“比”弄得晕头转向的你 ~</p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-8">
            <Venti mood="happy" message={ventiMessage} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
             <button 
                onClick={() => setMode(GameMode.TUTORIAL)}
                className="bg-geo hover:bg-yellow-500 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2">
                <span>📖</span> 温迪的补习角 (Tutorial)
             </button>
             <button 
                onClick={() => startGame(GameMode.PRACTICE)}
                className="bg-anemo-500 hover:bg-anemo-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2">
                <span>⚔️</span> 基础特训 (Practice)
             </button>
             <button 
                onClick={() => startGame(GameMode.ADVENTURE)}
                className="col-span-1 md:col-span-2 bg-electro hover:bg-purple-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2">
                <span>✨</span> 提瓦特应用题 (Adventure)
             </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Tutorial ---
  if (mode === GameMode.TUTORIAL) {
      return (
        <div className="min-h-screen p-4 flex flex-col items-center">
             <div className="max-w-3xl w-full bg-white rounded-3xl shadow-xl p-8 border-2 border-anemo-200 mt-10">
                <h2 className="text-3xl font-bold text-anemo-600 mb-6 text-center">温迪的补习角</h2>
                
                <p className="text-gray-600 text-center mb-8 italic">
                    "别难过，有时候数字就像音符，需要找到它们的节奏。来，我们重新认识一下'比'。"
                </p>

                <div className="space-y-8">
                    <div className="bg-anemo-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-anemo-800 mb-4 flex items-center gap-2">
                            <span className="bg-anemo-500 text-white w-8 h-8 rounded-full flex items-center justify-center">1</span>
                            什么是比？ (Ratio)
                        </h3>
                        <p className="text-lg text-gray-700 mb-4 leading-relaxed">
                            比就是两个数量之间的“关系”。<br/>
                            比如：我有2个苹果，你有3个苹果。<br/>
                            我们的苹果数量比就是 <strong className="text-anemo-600 text-2xl">2 : 3</strong>。<br/>
                            前面的叫<strong>前项</strong>，后面的叫<strong>后项</strong>。
                        </p>
                    </div>

                    <div className="bg-orange-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-orange-800 mb-4 flex items-center gap-2">
                            <span className="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center">2</span>
                            化简比 (Simplify) - 变瘦变精神！
                        </h3>
                        <p className="text-lg text-gray-700 mb-2">
                            我们喜欢最简单的数字。比如 <strong>10 : 20</strong>，太臃肿了！<br/>
                            我们要同时除以它们的“最大公因数”。<br/>
                            10和20都能被10整除，所以除以10，变成 <strong className="text-orange-600">1 : 2</strong>。
                        </p>
                        <div className="bg-white p-4 rounded-lg shadow-sm mt-2 text-gray-600">
                             结果仍然是一个比，要有冒号哦！
                        </div>
                    </div>

                    <div className="bg-pink-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-pink-800 mb-4 flex items-center gap-2">
                            <span className="bg-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center">3</span>
                            求比值 (Value) - 变成一个数
                        </h3>
                        <p className="text-lg text-gray-700 mb-2">
                            这就简单了！用<strong>前项 ÷ 后项</strong>。<br/>
                            比如 2 : 5 的比值，就是 2 ÷ 5 = <strong className="text-pink-600">0.4</strong> (或者 2/5)。
                        </p>
                         <div className="bg-white p-4 rounded-lg shadow-sm text-center font-mono text-xl text-pink-700 mt-2">
                             结果是一个数，没有冒号！
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => setMode(GameMode.MENU)}
                    className="mt-8 w-full bg-anemo-500 text-white font-bold py-3 rounded-xl hover:bg-anemo-600 transition">
                    稍微懂了一点，去试试看！
                </button>
             </div>
        </div>
      )
  }

  // --- Render: Main Game Interface ---
  return (
    <div className="min-h-screen bg-anemo-50 flex flex-col items-center py-6 px-4">
      {/* Header / Stats */}
      <header className="w-full max-w-4xl flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-anemo-100 mb-6 sticky top-0 z-10">
         <button onClick={() => setMode(GameMode.MENU)} className="text-anemo-600 font-bold hover:underline">
            ← 退出
         </button>
         <div className="flex gap-6 font-bold text-gray-700">
             <div className="flex items-center gap-2">
                <span className="text-yellow-500 text-xl">★</span>
                <span>得分: {gameState.score}</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-red-500 text-xl">🔥</span>
                <span>连胜: {gameState.streak}</span>
             </div>
         </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-2xl flex flex-col gap-6 mb-24">
        
        {/* Venti Area */}
        <Venti mood={ventiMood} message={ventiMessage} />

        {/* Question Card */}
        {currentQuestion && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border-2 border-anemo-100 animate-fade-in relative">
                
                {/* Question Display */}
                <div className="mb-8 text-center">
                    {currentQuestion.type === 'word' ? (
                        <p className="text-xl md:text-2xl leading-relaxed text-gray-800 font-medium">
                            {currentQuestion.text}
                        </p>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-6 py-4">
                            <div className="bg-gray-50 px-8 py-6 rounded-2xl border border-gray-200">
                                <div className="text-4xl font-bold text-gray-800 tracking-wider">
                                    {currentQuestion.text.split('：')[1]}
                                </div>
                            </div>
                            <div className="text-lg font-bold text-anemo-600 bg-anemo-50 px-4 py-1 rounded-full">
                                {currentQuestion.subType === 'simplify' ? "请化简这个比 (答案格式 a:b)" : "请计算比值 (答案是一个数)"}
                            </div>
                        </div>
                    )}
                </div>

                {/* Answer Input */}
                <div className="flex flex-col items-center gap-4">
                    <div className="w-full max-w-sm relative">
                        {/* Hint Button (Visible when idle) */}
                        {feedbackState === 'idle' && !hasUsedHint && (
                            <button 
                                onClick={handleShowHint}
                                className="absolute -top-10 right-0 text-yellow-500 hover:text-yellow-600 font-bold text-sm bg-yellow-50 hover:bg-yellow-100 px-3 py-1 rounded-full border border-yellow-200 transition flex items-center gap-1 shadow-sm">
                                💡 求助温迪
                            </button>
                        )}

                        <p className="text-sm text-gray-500 uppercase tracking-widest font-bold text-center mb-2">你的答案</p>
                        
                        {feedbackState !== 'correct' && feedbackState !== 'incorrect' ? (
                            <input 
                                type="text"
                                placeholder={currentQuestion.subType === 'simplify' || currentQuestion.type === 'word' ? "例如 2:3" : "例如 0.5"}
                                value={inputAnswer}
                                onChange={(e) => setInputAnswer(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && inputAnswer && handleSubmit()}
                                className="w-full text-center text-3xl p-4 border-2 border-gray-200 rounded-xl focus:border-anemo-400 focus:outline-none placeholder:text-gray-300 placeholder:text-xl"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-4 animate-bounce-in w-full">
                                <div className={`p-4 rounded-xl border-4 w-full text-center ${feedbackState === 'correct' ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700'}`}>
                                    <span className="text-2xl font-bold">
                                        {feedbackState === 'correct' ? "回答正确!" : "别气馁!"}
                                    </span>
                                </div>
                                {feedbackState === 'incorrect' && (
                                    <div className="text-xl text-gray-600 flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
                                        正确答案是: <span className="font-bold text-anemo-600">{currentQuestion.correctAnswer}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </main>

      {/* Sticky Bottom Actions */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-gray-200 flex justify-center z-20">
         <div className="w-full max-w-2xl flex gap-4">
            {feedbackState === 'idle' && (
                 <button 
                    onClick={handleSubmit}
                    disabled={!inputAnswer}
                    className="w-full bg-anemo-500 hover:bg-anemo-600 disabled:bg-gray-300 text-white font-bold text-xl py-4 rounded-2xl shadow-lg transition transform active:scale-95">
                    提交答案
                </button>
            )}
            
            {feedbackState === 'loading' && (
                <button disabled className="w-full bg-gray-100 text-gray-400 font-bold text-xl py-4 rounded-2xl cursor-wait flex justify-center items-center gap-2">
                    <span className="animate-spin text-2xl">🍃</span> 呼唤风神中...
                </button>
            )}

            {(feedbackState === 'correct' || feedbackState === 'incorrect') && (
                 <button 
                    onClick={handleNext}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-xl py-4 rounded-2xl shadow-lg transition transform active:scale-95 animate-pulse-slow">
                    下一题 →
                </button>
            )}
         </div>
      </footer>

      {/* Reward Modal */}
      {showRewardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-100 to-transparent opacity-50"></div>
                <h2 className="text-3xl font-bold text-yellow-600 mb-4 relative z-10">获得成就!</h2>
                <div className="text-6xl mb-4 animate-bounce relative z-10">💎</div>
                <p className="text-gray-700 text-lg mb-6 relative z-10">连续答对5题！<br/>温迪为你弹奏一曲！(获得10原石)</p>
                <button 
                    onClick={() => setShowRewardModal(false)}
                    className="bg-anemo-500 text-white font-bold py-3 px-8 rounded-xl hover:bg-anemo-600 transition relative z-10">
                    收下
                </button>
            </div>
        </div>
      )}
    </div>
  );
}