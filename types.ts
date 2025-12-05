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
  
  // Specific for Circle Practice
  // basic: r <-> d relationship
  // circumference: C = pi * d
  // area: S = pi * r^2
  subType?: 'basic' | 'circumference' | 'area';
  
  // Answers for circles are usually numbers (floats)
  correctAnswer: number; 
  explanation?: string; 
  
  // Hint for the user
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