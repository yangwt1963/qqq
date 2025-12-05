export enum GameMode {
  MENU = 'MENU',
  TUTORIAL = 'TUTORIAL',
  PRACTICE = 'PRACTICE', // Basic calculation
  ADVENTURE = 'ADVENTURE', // Word problems
}

export interface Question {
  id: string;
  type: 'calculation' | 'word';
  text: string;
  // For calculation display
  radius?: number;
  diameter?: number;
  target?: 'circumference' | 'area'; 
  
  correctAnswer: number;
  explanation?: string; // Pre-calculated or AI generated
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