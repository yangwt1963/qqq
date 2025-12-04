export enum GameMode {
  MENU = 'MENU',
  TUTORIAL = 'TUTORIAL',
  PRACTICE = 'PRACTICE', // Basic calculation
  ADVENTURE = 'ADVENTURE', // Word problems
}

export interface Fraction {
  numerator: number;
  denominator: number;
}

export interface Question {
  id: string;
  type: 'calculation' | 'word';
  text: string;
  operandA?: Fraction;
  operandB?: Fraction;
  operation?: 'multiply' | 'divide';
  correctAnswer: Fraction;
  explanation?: string; // Pre-calculated or AI generated
  options?: Fraction[]; // For multiple choice
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