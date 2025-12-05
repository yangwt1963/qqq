import React, { useState } from 'react';
import { GameMode, Question, GameState, FeedbackType } from './types';
import { Venti } from './components/Venti';
import { getVentiFeedback, generateGenshinProblem } from './services/geminiService';

export default function App() {
  // --- State ---
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [inputAnswer, setInputAnswer] = useState<string>('');
  
  const [ventiMessage, setVentiMessage] = useState<string>("听说你在课堂上对“圆”有点晕头转向？\n没关系，风神温迪来教你。圆是最完美的形状，就像风的循环一样。");
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
    // 30% r <-> d, 35% Circumference, 35% Area
    const rand = Math.random();
    const id = Date.now().toString();
    
    // Use integers for radius mostly to make math slightly easier
    const r = Math.floor(Math.random() * 9) + 1; // 1-9
    
    if (rand < 0.3) {
        // Basic r <-> d
        // Ask for Diameter given Radius
        const ans = r * 2;
        return {
            id,
            type: 'calculation',
            subType: 'basic',
            text: `如果一个圆的半径 (r) 是 ${r} 厘米，它的直径 (d) 是多少？`,
            correctAnswer: ans,
            hint: "还记得吗？直径是半径的 2 倍哦。(d = 2r)"
        };
    } else if (rand < 0.65) {
        // Circumference
        // C = 2 * 3.14 * r
        const ans = parseFloat((2 * 3.14 * r).toFixed(2));
        return {
            id,
            type: 'calculation',
            subType: 'circumference',
            text: `求半径 r = ${r} 厘米的圆的周长 (C)。(π取3.14)`,
            correctAnswer: ans,
            hint: `圆的周长公式是 C = 2πr。也就是 2 × 3.14 × ${r}。`
        };
    } else {
        // Area
        // S = 3.14 * r^2
        const ans = parseFloat((3.14 * r * r).toFixed(2));
        return {
            id,
            type: 'calculation',
            subType: 'area',
            text: `求半径 r = ${r} 厘米的圆的面积 (S)。(π取3.14)`,
            correctAnswer: ans,
            hint: `圆的面积公式是 S = πr²。记得先算 ${r} × ${r}，再乘 3.14 哦。`
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
      setVentiMessage("来，我们从最简单的公式开始练习。");
      setVentiMood('neutral');
    } else if (selectedMode === GameMode.ADVENTURE) {
        setVentiMessage("让我看看冒险家协会有没有什么委托... (生成题目中...)");
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
            setVentiMessage("新的委托来了！注意看清是求周长还是面积哦。");
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
    if (!inputAnswer) return;

    setFeedbackState('loading');
    setVentiMessage("嗯... 风神正在验算...");
    setVentiMood('thinking');

    // Number check with tolerance
    const userVal = parseFloat(inputAnswer);
    const correctVal = currentQuestion.correctAnswer;
    
    // Allow 0.05 margin of error for float arithmetic
    let isCorrect = Math.abs(userVal - correctVal) <= 0.05;

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

    // AI Feedback
    if (!isCorrect || currentQuestion.type === 'word') {
         const feedback = await getVentiFeedback(
             currentQuestion.text, 
             inputAnswer, 
             currentQuestion.correctAnswer.toString(), 
             isCorrect
         );
         setVentiMessage(feedback);
    } else {
         const praises = [
             "这就对了！圆满的答案！",
             "像风神护盾一样完美的圆！",
             "你已经掌握了 π 的奥秘！"
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
       setVentiMessage("下一道题来了，准备好了吗？");
    } else if (mode === GameMode.ADVENTURE) {
        setVentiMessage("寻找下一个委托...");
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
            setVentiMessage("加油！");
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
            <h1 className="text-4xl md:text-6xl font-bold text-anemo-600 mb-4 tracking-wider">温迪的圆之歌谣</h1>
            <p className="text-xl text-gray-600">Traveler's Circle Ballad</p>
            <p className="text-md text-anemo-500 mt-2 font-bold">~ 献给正在学习圆周率的你 ~</p>
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
                <h2 className="text-3xl font-bold text-anemo-600 mb-6 text-center">温迪的补习角 - 圆的世界</h2>
                
                <div className="space-y-8">
                    <div className="bg-anemo-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-anemo-800 mb-4">1. 认识圆 (Radius & Diameter)</h3>
                        <p className="text-lg text-gray-700">
                            <strong>圆心 (O)</strong> 是圆正中心。
                            <br/><strong>半径 (r)</strong> 是圆心到圆边的距离。
                            <br/><strong>直径 (d)</strong> 是穿过圆心的一条线。
                            <br/>口诀：<span className="text-anemo-600 font-bold">直径是半径的2倍 (d = 2r)</span>。
                        </p>
                    </div>

                    <div className="bg-orange-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-orange-800 mb-4">2. 圆周率 (π)</h3>
                        <p className="text-lg text-gray-700">
                            不论圆有多大，它的周长除以直径，永远等于同一个数，叫做 <strong>π (pai)</strong>。
                            <br/>在小学数学里，我们通常取 <strong className="text-orange-600">π ≈ 3.14</strong>。
                        </p>
                    </div>

                    <div className="bg-pink-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-pink-800 mb-4">3. 周长与面积 (Circumference & Area)</h3>
                        <ul className="list-disc list-inside text-lg text-gray-700 space-y-2">
                            <li><strong>周长 (C)</strong>：围成圆的线的长度。<br/>公式：<strong className="text-pink-600">C = πd</strong> 或 <strong className="text-pink-600">C = 2πr</strong></li>
                            <li><strong>面积 (S)</strong>：圆里面的大小。<br/>公式：<strong className="text-pink-600">S = πr²</strong> (就是 π × r × r)</li>
                        </ul>
                    </div>
                </div>

                <button 
                    onClick={() => setMode(GameMode.MENU)}
                    className="mt-8 w-full bg-anemo-500 text-white font-bold py-3 rounded-xl hover:bg-anemo-600 transition">
                    记住了，去试试！
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
                    <p className="text-xl md:text-2xl leading-relaxed text-gray-800 font-medium">
                        {currentQuestion.text}
                    </p>
                    {currentQuestion.type === 'calculation' && (
                        <div className="mt-4 text-sm text-gray-500">
                           {currentQuestion.subType === 'area' && "(记得带单位：平方厘米)"}
                           {currentQuestion.subType === 'circumference' && "(记得带单位：厘米)"}
                        </div>
                    )}
                </div>

                {/* Answer Input */}
                <div className="flex flex-col items-center gap-4">
                    <div className="w-full max-w-sm relative">
                        {/* Hint Button */}
                        {feedbackState === 'idle' && !hasUsedHint && (
                            <button 
                                onClick={handleShowHint}
                                className="absolute -top-10 right-0 text-yellow-500 hover:text-yellow-600 font-bold text-sm bg-yellow-50 hover:bg-yellow-100 px-3 py-1 rounded-full border border-yellow-200 transition flex items-center gap-1 shadow-sm">
                                💡 求助温迪
                            </button>
                        )}

                        <p className="text-sm text-gray-500 uppercase tracking-widest font-bold text-center mb-2">你的答案 (数字)</p>
                        
                        {feedbackState !== 'correct' && feedbackState !== 'incorrect' ? (
                            <input 
                                type="number"
                                placeholder="输入数字..."
                                value={inputAnswer}
                                onChange={(e) => setInputAnswer(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && inputAnswer && handleSubmit()}
                                className="w-full text-center text-3xl p-4 border-2 border-gray-200 rounded-xl focus:border-anemo-400 focus:outline-none placeholder:text-gray-300 placeholder:text-xl"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-4 animate-bounce-in w-full">
                                <div className={`p-4 rounded-xl border-4 w-full text-center ${feedbackState === 'correct' ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700'}`}>
                                    <span className="text-2xl font-bold">
                                        {feedbackState === 'correct' ? "回答正确!" : "再试一次!"}
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