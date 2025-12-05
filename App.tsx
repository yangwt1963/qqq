import React, { useState } from 'react';
import { GameMode, Question, GameState, FeedbackType } from './types';
import { Venti } from './components/Venti';
import { getVentiFeedback, generateGenshinProblem } from './services/geminiService';

// Standard 6th Grade PI
const PI = 3.14;

export default function App() {
  // --- State ---
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [inputAnswer, setInputAnswer] = useState<string>('');
  
  const [ventiMessage, setVentiMessage] = useState<string>("听说你在课堂上对“圆”感到困惑？别担心，我是提瓦特最好的吟游诗人，也是很棒的老师哦！");
  const [ventiMood, setVentiMood] = useState<'happy' | 'thinking' | 'surprised' | 'neutral'>('happy');
  const [feedbackState, setFeedbackState] = useState<FeedbackType>('idle');
  
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    streak: 0,
    totalAnswered: 0,
    currentQuestionIndex: 0,
    history: []
  });
  const [showRewardModal, setShowRewardModal] = useState(false);

  // --- Logic: Generate Basic Question ---
  const generateBasicQuestion = (): Question => {
    // 50% chance for Circumference vs Area
    // 50% chance for Radius vs Diameter given
    const isArea = Math.random() > 0.5;
    const isRadiusGiven = Math.random() > 0.6; // Slightly more likely to give Radius

    // Generate easy numbers (integers 1-10, or multiples of 10)
    let val = Math.floor(Math.random() * 9) + 1; // 1-9
    if (Math.random() > 0.7) val = val * 10; // 10, 20, 30...

    let answer = 0;
    let text = '';
    
    // r or d
    const r = isRadiusGiven ? val : val / 2;
    const d = isRadiusGiven ? val * 2 : val;

    if (isArea) {
      // Area = PI * r * r
      // 6th grade math usually retains 2 decimal places max for PI=3.14 calculations, 
      // but javascript float math can be messy.
      answer = parseFloat((PI * r * r).toFixed(2));
      text = `求圆的面积 (S)`;
    } else {
      // Circumference = PI * d
      answer = parseFloat((PI * d).toFixed(2));
      text = `求圆的周长 (C)`;
    }

    return {
      id: Date.now().toString(),
      type: 'calculation',
      text,
      radius: isRadiusGiven ? val : undefined,
      diameter: !isRadiusGiven ? val : undefined,
      target: isArea ? 'area' : 'circumference',
      correctAnswer: answer
    };
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
    
    if (selectedMode === GameMode.PRACTICE) {
      setCurrentQuestion(generateBasicQuestion());
      setVentiMessage("让我们从最基础的画圆开始吧！哪怕老师讲得太快，风也会等你。");
      setVentiMood('neutral');
    } else if (selectedMode === GameMode.ADVENTURE) {
        setVentiMessage("让我看看... 提瓦特大陆上哪里有完美的圆呢？ (生成题目中)");
        setFeedbackState('loading');
        const problem = await generateGenshinProblem();
        setFeedbackState('idle');
        if (problem) {
            setCurrentQuestion({
                id: Date.now().toString(),
                type: 'word',
                text: problem.text,
                correctAnswer: problem.answer,
                explanation: problem.explanation
            });
            setVentiMessage("听听这个故事，旅行者，即使是圆，也有它的故事哦。");
        } else {
             // Fallback
             setVentiMessage("风神稍微打了个盹... 我们先做个基础题吧。");
             setMode(GameMode.PRACTICE);
             setCurrentQuestion(generateBasicQuestion());
        }
    }
  };

  // --- Logic: Submit Answer ---
  const handleSubmit = async () => {
    if (!currentQuestion) return;

    const userVal = parseFloat(inputAnswer);

    if (isNaN(userVal)) {
        setVentiMessage("诶嘿？这似乎不是一个数字哦。");
        setVentiMood('surprised');
        return;
    }

    setFeedbackState('loading');
    setVentiMessage("嗯... 让风神来验算一下...");
    setVentiMood('thinking');

    // Logic Check: Allow very small epsilon for floating point, though typically exact with 3.14
    // But since input is string based on user typing, exact match of fixed(2) is usually what's expected in 6th grade
    const correctVal = currentQuestion.correctAnswer;
    const diff = Math.abs(userVal - correctVal);
    const isCorrect = diff < 0.01; // Strict enough for 2 decimal places

    // Update Stats
    const newStreak = isCorrect ? gameState.streak + 1 : 0;
    setGameState(prev => ({
      ...prev,
      score: isCorrect ? prev.score + 10 : prev.score,
      streak: newStreak,
      totalAnswered: prev.totalAnswered + 1,
      history: [...prev.history, { questionId: currentQuestion.id, isCorrect }]
    }));

    // Check for Reward (Every 5 correct)
    if (isCorrect && newStreak > 0 && newStreak % 5 === 0) {
        setShowRewardModal(true);
    }

    // Generate Context string for AI
    let contextQuestion = currentQuestion.text;
    if (currentQuestion.type === 'calculation') {
        const param = currentQuestion.radius ? `r=${currentQuestion.radius}` : `d=${currentQuestion.diameter}`;
        contextQuestion = `${textForType(currentQuestion.target)}, 已知 ${param}`;
    }

    // AI Feedback
    if (!isCorrect || currentQuestion.type === 'word') {
         const feedback = await getVentiFeedback(contextQuestion, userVal.toString(), correctVal.toString(), isCorrect);
         setVentiMessage(feedback);
    } else {
         // Simple random praise for correct calculation to save API calls
         const praises = [
             "太棒了！你的思绪像风一样清晰！",
             "完全正确！看来课堂上的乌云已经散去了！",
             "就是这样！圆周率也被你征服了呢！"
         ];
         setVentiMessage(praises[Math.floor(Math.random() * praises.length)]);
    }

    setVentiMood(isCorrect ? 'happy' : 'surprised');
    setFeedbackState(isCorrect ? 'correct' : 'incorrect');
  };

  const textForType = (t?: string) => t === 'area' ? '求面积 (S)' : '求周长 (C)';

  // --- Logic: Next Question ---
  const handleNext = async () => {
    setInputAnswer('');
    setFeedbackState('idle');
    setVentiMood('neutral');

    if (mode === GameMode.PRACTICE) {
       setCurrentQuestion(generateBasicQuestion());
       setVentiMessage("风向改变了，下一道题要来了哦！");
    } else if (mode === GameMode.ADVENTURE) {
        setVentiMessage("正在寻找下一个冒险...");
        setFeedbackState('loading');
        const problem = await generateGenshinProblem();
        setFeedbackState('idle');
        if (problem) {
            setCurrentQuestion({
                id: Date.now().toString(),
                type: 'word',
                text: problem.text,
                correctAnswer: problem.answer,
                explanation: problem.explanation
            });
            setVentiMessage("新的委托！");
        } else {
            setVentiMessage("好像没有委托了，我们先休息一下，回到基础训练。");
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
            <h1 className="text-4xl md:text-6xl font-bold text-anemo-600 mb-4 tracking-wider">温迪的几何歌谣</h1>
            <p className="text-xl text-gray-600">Traveler's Geometry Ballad</p>
            <p className="text-md text-anemo-500 mt-2 font-bold">~ 献给在课堂上对“圆”感到迷茫的你 ~</p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-8">
            <Venti mood="happy" message={ventiMessage} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
             <button 
                onClick={() => setMode(GameMode.TUTORIAL)}
                className="bg-geo hover:bg-yellow-500 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2">
                <span>📖</span> 温迪补习班 (Tutorial)
             </button>
             <button 
                onClick={() => startGame(GameMode.PRACTICE)}
                className="bg-anemo-500 hover:bg-anemo-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2">
                <span>⚔️</span> 基础试炼 (Practice)
             </button>
             <button 
                onClick={() => startGame(GameMode.ADVENTURE)}
                className="col-span-1 md:col-span-2 bg-electro hover:bg-purple-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2">
                <span>✨</span> 深境螺旋应用题 (Adventure)
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
                <h2 className="text-3xl font-bold text-anemo-600 mb-6 text-center">温迪的几何补习班</h2>
                
                <p className="text-gray-600 text-center mb-8 italic">
                    "我也经常记不住乐谱呢，所以没听懂也没关系。让我们重新认识一下这位叫'圆'的朋友。"
                </p>

                <div className="space-y-8">
                    <div className="bg-anemo-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-anemo-800 mb-4 flex items-center gap-2">
                            <span className="bg-anemo-500 text-white w-8 h-8 rounded-full flex items-center justify-center">1</span>
                            那个神奇的数字 π (3.14)
                        </h3>
                        <p className="text-lg text-gray-700 mb-4 leading-relaxed">
                            就像风无处不在，圆的周长总是它直径的 3倍多一点点。<br/>
                            无论圆是大是小，这个倍数永远不变，我们叫它 <strong className="text-anemo-600 text-2xl">π</strong>。<br/>
                            为了方便计算，我们通常把它的“尾巴”藏起来，只记作 <strong>3.14</strong>。
                        </p>
                    </div>

                    <div className="bg-orange-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-orange-800 mb-4 flex items-center gap-2">
                            <span className="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center">2</span>
                            圆的周长 (C) - 给圆围个围巾
                        </h3>
                        <p className="text-lg text-gray-700 mb-2">
                            只要知道直径(d)，乘以 3.14 就是周长。
                        </p>
                        <div className="bg-white p-4 rounded-lg shadow-sm text-center font-mono text-xl text-orange-700">
                             C = πd <span className="text-gray-400 mx-2">或</span> C = 2πr
                        </div>
                    </div>

                    <div className="bg-pink-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-pink-800 mb-4 flex items-center gap-2">
                            <span className="bg-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center">3</span>
                            圆的面积 (S) - 铺满整个圆
                        </h3>
                        <p className="text-lg text-gray-700 mb-2">
                            面积和半径(r)关系最大！记得是半径的“平方”（自己乘自己），再乘 3.14。
                        </p>
                         <div className="bg-white p-4 rounded-lg shadow-sm text-center font-mono text-xl text-pink-700">
                             S = πr²
                        </div>
                        <p className="text-sm text-gray-500 mt-2 text-center">千万别把平方忘了哦！是 r × r，不是 r × 2！</p>
                    </div>
                </div>

                <button 
                    onClick={() => setMode(GameMode.MENU)}
                    className="mt-8 w-full bg-anemo-500 text-white font-bold py-3 rounded-xl hover:bg-anemo-600 transition">
                    我觉得我行了！回去试炼！
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
            <div className="bg-white rounded-3xl shadow-xl p-8 border-2 border-anemo-100 animate-fade-in">
                
                {/* Question Display */}
                <div className="mb-8 text-center">
                    {currentQuestion.type === 'word' ? (
                        <p className="text-xl md:text-2xl leading-relaxed text-gray-800 font-medium">
                            {currentQuestion.text}
                        </p>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-6 py-4">
                            {/* Visual Representation of Circle Param */}
                            <div className="relative w-32 h-32 rounded-full border-4 border-gray-300 flex items-center justify-center bg-gray-50">
                                <div className="absolute w-1 h-1 bg-black rounded-full"></div>
                                {currentQuestion.radius && (
                                    <>
                                        <div className="absolute top-1/2 left-1/2 w-1/2 h-0.5 bg-anemo-500"></div>
                                        <div className="absolute top-1/2 left-3/4 -translate-y-4 text-anemo-600 font-bold">r={currentQuestion.radius}</div>
                                    </>
                                )}
                                {currentQuestion.diameter && (
                                     <>
                                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-orange-400"></div>
                                        <div className="absolute top-1/2 left-1/2 -translate-y-4 text-orange-600 font-bold">d={currentQuestion.diameter}</div>
                                    </>
                                )}
                            </div>
                            
                            <div className="text-2xl font-bold text-gray-800">
                                {currentQuestion.text}
                            </div>
                            <div className="text-sm text-gray-400 font-mono">
                                (π 取 3.14)
                            </div>
                        </div>
                    )}
                </div>

                {/* Answer Input */}
                <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">你的答案 (数字)</p>
                    
                    {feedbackState !== 'correct' && feedbackState !== 'incorrect' ? (
                         <div className="flex items-center gap-4 w-full max-w-xs">
                            <input 
                                type="number" 
                                placeholder="输入结果..."
                                value={inputAnswer}
                                onChange={(e) => setInputAnswer(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && inputAnswer && handleSubmit()}
                                className="w-full text-center text-3xl p-4 border-2 border-gray-200 rounded-xl focus:border-anemo-400 focus:outline-none"
                            />
                         </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 animate-bounce-in w-full">
                            <div className={`p-4 rounded-xl border-4 w-full text-center ${feedbackState === 'correct' ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700'}`}>
                                <span className="text-2xl font-bold">
                                    {feedbackState === 'correct' ? "正确!" : "再接再厉"}
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
                <p className="text-gray-700 text-lg mb-6 relative z-10">连续答对5题！温迪送你一颗大苹果 (和10原石)!</p>
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