import React, { useState, useEffect, useRef } from 'react';
import { GameMode, Question, GameState, Fraction as FractionType, FeedbackType } from './types';
import { Fraction } from './components/Fraction';
import { Venti } from './components/Venti';
import { getVentiFeedback, generateGenshinProblem } from './services/geminiService';

// --- Helper: Simplify Fraction ---
const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b);
};

const simplify = (num: number, den: number): FractionType => {
  const common = gcd(Math.abs(num), Math.abs(den));
  return {
    numerator: num / common,
    denominator: den / common
  };
};

const stringifyFraction = (f: FractionType) => `${f.numerator}/${f.denominator}`;

export default function App() {
  // --- State ---
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [inputNumerator, setInputNumerator] = useState<string>('');
  const [inputDenominator, setInputDenominator] = useState<string>('');
  const [ventiMessage, setVentiMessage] = useState<string>("你好呀，旅行者！准备好在提瓦特大陆进行一场数学冒险了吗？");
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
    const isMultiply = Math.random() > 0.5;
    // Generate numbers suitable for 6th grade (avoid huge numbers)
    const n1 = Math.floor(Math.random() * 8) + 1;
    const d1 = Math.floor(Math.random() * 8) + 2;
    const n2 = Math.floor(Math.random() * 8) + 1;
    const d2 = Math.floor(Math.random() * 8) + 2;

    const f1 = simplify(n1, d1);
    const f2 = simplify(n2, d2);

    let resNum, resDen;
    let text = '';

    if (isMultiply) {
      resNum = f1.numerator * f2.numerator;
      resDen = f1.denominator * f2.denominator;
      text = "计算结果 (最简分数):";
    } else {
      // Division
      resNum = f1.numerator * f2.denominator;
      resDen = f1.denominator * f2.numerator;
      text = "计算结果 (最简分数):";
    }

    const correct = simplify(resNum, resDen);

    return {
      id: Date.now().toString(),
      type: 'calculation',
      text,
      operandA: f1,
      operandB: f2,
      operation: isMultiply ? 'multiply' : 'divide',
      correctAnswer: correct
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
    setInputNumerator('');
    setInputDenominator('');
    
    if (selectedMode === GameMode.PRACTICE) {
      setCurrentQuestion(generateBasicQuestion());
      setVentiMessage("简单的飞行训练开始了！让我们看看你的基本功吧。");
      setVentiMood('neutral');
    } else if (selectedMode === GameMode.ADVENTURE) {
        setVentiMessage("正在聆听风中的讯息... (生成题目中)");
        setFeedbackState('loading');
        const problem = await generateGenshinProblem();
        setFeedbackState('idle');
        if (problem) {
            setCurrentQuestion({
                id: Date.now().toString(),
                type: 'word',
                text: problem.text,
                correctAnswer: simplify(problem.answerNumerator, problem.answerDenominator),
                explanation: problem.explanation
            });
            setVentiMessage("听听这个故事，旅行者，你能帮我算算吗？");
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
    if (!currentQuestion || !inputNumerator || !inputDenominator) return;

    setFeedbackState('loading');
    setVentiMessage("嗯... 让我仔细看看你的答案...");
    setVentiMood('thinking');

    const userNum = parseInt(inputNumerator);
    const userDen = parseInt(inputDenominator);
    const userSimp = simplify(userNum, userDen);
    const correctSimp = currentQuestion.correctAnswer;

    const isCorrect = userSimp.numerator === correctSimp.numerator && userSimp.denominator === correctSimp.denominator;

    // Update Stats
    const newStreak = isCorrect ? gameState.streak + 1 : 0;
    setGameState(prev => ({
      ...prev,
      score: isCorrect ? prev.score + 10 : prev.score,
      streak: newStreak,
      totalAnswered: prev.totalAnswered + 1,
      history: [...prev.history, { questionId: currentQuestion.id, isCorrect }]
    }));

    // AI Feedback
    const userFractionStr = `${userNum}/${userDen}`;
    const correctFractionStr = `${correctSimp.numerator}/${correctSimp.denominator}`;
    
    // Check for Reward (Every 5 correct)
    if (isCorrect && newStreak > 0 && newStreak % 5 === 0) {
        setShowRewardModal(true);
    }

    if (currentQuestion.type === 'word') {
        // Use explanation from AI generation if available, else fetch logic
        if (!isCorrect) {
             const feedback = await getVentiFeedback(currentQuestion.text, userFractionStr, correctFractionStr, isCorrect);
             setVentiMessage(feedback);
        } else {
            setVentiMessage("太棒了！风神为你欢呼！");
        }
    } else {
        // Basic Calculation Feedback
        const feedback = await getVentiFeedback(
            `${stringifyFraction(currentQuestion.operandA!)} ${currentQuestion.operation === 'multiply' ? '×' : '÷'} ${stringifyFraction(currentQuestion.operandB!)}`,
            userFractionStr,
            correctFractionStr,
            isCorrect
        );
        setVentiMessage(feedback);
    }

    setVentiMood(isCorrect ? 'happy' : 'surprised');
    setFeedbackState(isCorrect ? 'correct' : 'incorrect');
  };

  // --- Logic: Next Question ---
  const handleNext = async () => {
    setInputNumerator('');
    setInputDenominator('');
    setFeedbackState('idle');
    setVentiMood('neutral');

    if (mode === GameMode.PRACTICE) {
       setCurrentQuestion(generateBasicQuestion());
       setVentiMessage("下一阵风吹来了，准备好了吗？");
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
                correctAnswer: simplify(problem.answerNumerator, problem.answerDenominator),
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
            <h1 className="text-4xl md:text-6xl font-bold text-anemo-600 mb-4 tracking-wider">温迪的数学史诗</h1>
            <p className="text-xl text-gray-600">Traveler's Fraction Adventure</p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-8">
            <Venti mood="happy" message={ventiMessage} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
             <button 
                onClick={() => setMode(GameMode.TUTORIAL)}
                className="bg-geo hover:bg-yellow-500 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2">
                <span>📖</span> 基础讲解 (Basic)
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
                <h2 className="text-3xl font-bold text-anemo-600 mb-6 text-center">温迪的吟游课堂</h2>
                
                <div className="space-y-8">
                    <div className="bg-anemo-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-anemo-800 mb-4 flex items-center gap-2">
                            <span className="bg-anemo-500 text-white w-8 h-8 rounded-full flex items-center justify-center">1</span>
                            分数乘法
                        </h3>
                        <p className="text-lg text-gray-700 mb-4">
                            "分子乘分子，分母乘分母。记得要约分哦！"
                        </p>
                        <div className="flex items-center justify-center gap-4 text-2xl bg-white p-4 rounded-lg shadow-inner">
                            <Fraction numerator={2} denominator={3} />
                            <span>×</span>
                            <Fraction numerator={4} denominator={5} />
                            <span>=</span>
                            <Fraction numerator="2×4" denominator="3×5" />
                            <span>=</span>
                            <Fraction numerator={8} denominator={15} />
                        </div>
                    </div>

                    <div className="bg-pink-50 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-pink-800 mb-4 flex items-center gap-2">
                            <span className="bg-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center">2</span>
                            分数除法
                        </h3>
                        <p className="text-lg text-gray-700 mb-4">
                            "除以一个数，等于乘以这个数的<span className="font-bold text-pink-600">倒数</span>（上下颠倒）。"
                        </p>
                        <div className="flex items-center justify-center gap-4 text-2xl bg-white p-4 rounded-lg shadow-inner">
                            <Fraction numerator={2} denominator={3} />
                            <span>÷</span>
                            <Fraction numerator={5} denominator={7} />
                            <span>=</span>
                            <Fraction numerator={2} denominator={3} />
                            <span>×</span>
                            <Fraction numerator={7} denominator={5} className="text-pink-600 font-bold" />
                            <span>=</span>
                            <Fraction numerator={14} denominator={15} />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => setMode(GameMode.MENU)}
                    className="mt-8 w-full bg-anemo-500 text-white font-bold py-3 rounded-xl hover:bg-anemo-600 transition">
                    听懂了，回去吧！
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
                        <div className="flex items-center justify-center gap-4 text-4xl md:text-5xl text-gray-800 font-bold py-8">
                            <Fraction numerator={currentQuestion.operandA!.numerator} denominator={currentQuestion.operandA!.denominator} large />
                            <span className="text-anemo-500 mx-2">{currentQuestion.operation === 'multiply' ? '×' : '÷'}</span>
                            <Fraction numerator={currentQuestion.operandB!.numerator} denominator={currentQuestion.operandB!.denominator} large />
                            <span>=</span>
                            <span className="text-gray-300">?</span>
                        </div>
                    )}
                </div>

                {/* Answer Input */}
                <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">你的答案 (最简分数)</p>
                    
                    {feedbackState !== 'correct' && feedbackState !== 'incorrect' ? (
                         <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-2 w-24">
                                <input 
                                    type="number" 
                                    placeholder="分子"
                                    value={inputNumerator}
                                    onChange={(e) => setInputNumerator(e.target.value)}
                                    className="w-full text-center text-2xl p-2 border-2 border-gray-200 rounded-xl focus:border-anemo-400 focus:outline-none"
                                />
                                <div className="h-0.5 bg-gray-800 w-full"></div>
                                <input 
                                    type="number" 
                                    placeholder="分母"
                                    value={inputDenominator}
                                    onChange={(e) => setInputDenominator(e.target.value)}
                                    className="w-full text-center text-2xl p-2 border-2 border-gray-200 rounded-xl focus:border-anemo-400 focus:outline-none"
                                />
                            </div>
                         </div>
                    ) : (
                        <div className="flex items-center gap-4 animate-bounce-in">
                            <div className={`p-4 rounded-xl border-4 ${feedbackState === 'correct' ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700'}`}>
                                <span className="text-2xl font-bold">
                                    {feedbackState === 'correct' ? "正确!" : "错误"}
                                </span>
                            </div>
                            {feedbackState === 'incorrect' && (
                                <div className="text-xl text-gray-600 flex items-center gap-2">
                                    正确答案是: 
                                    <Fraction 
                                        numerator={currentQuestion.correctAnswer.numerator} 
                                        denominator={currentQuestion.correctAnswer.denominator} 
                                    />
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
                    disabled={!inputNumerator || !inputDenominator}
                    className="w-full bg-anemo-500 hover:bg-anemo-600 disabled:bg-gray-300 text-white font-bold text-xl py-4 rounded-2xl shadow-lg transition transform active:scale-95">
                    提交答案
                </button>
            )}
            
            {feedbackState === 'loading' && (
                <button disabled className="w-full bg-gray-100 text-gray-400 font-bold text-xl py-4 rounded-2xl cursor-wait flex justify-center items-center gap-2">
                    <span className="animate-spin text-2xl">🍃</span> 计算风向中...
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
                <p className="text-gray-700 text-lg mb-6 relative z-10">连续答对5题！风神赐予你 10 原石 (虚拟)!</p>
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