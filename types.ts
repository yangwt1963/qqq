export enum GameMode {
  MENU = 'MENU',
  TUTORIAL = 'TUTORIAL',
  PRACTICE = 'PRACTICE', // Basic calculation
  ADVENTURE = 'ADVENTURE', // Word problems
}

export interface Question {
  id: string;
  type: 'calculation' | 'word';
  text: string; // The question display text
  
  // Specific for Ratio Practice
  subType?: 'simplify' | 'value'; // simplify (化简比) or value (求比值)
  
  // Answers can be string (for "2:3") or number (for 0.5)
  correctAnswer: string | number; 
  explanation?: string; 
  
  // New: Hint for the user
  hint?: string;
}

export interface GameState {
  score: number;
  streak: number;
  totalAnswered: number;
  currentQuestionIndex: number;
  history: {
    questionId: string;
    isCorrect: boolean;
  }[];
}

export type FeedbackType = 'idle' | 'loading' | 'correct' | 'incorrect';