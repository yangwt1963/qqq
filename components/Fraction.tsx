import React from 'react';

interface FractionProps {
  numerator: number | string;
  denominator: number | string;
  className?: string;
  large?: boolean;
}

export const Fraction: React.FC<FractionProps> = ({ numerator, denominator, className = '', large = false }) => {
  const isInteger = Number(denominator) === 1;

  if (isInteger) {
    return <span className={`font-bold ${large ? 'text-3xl' : 'text-xl'} ${className}`}>{numerator}</span>;
  }

  return (
    <div className={`inline-flex flex-col items-center justify-center align-middle mx-1 ${className}`}>
      <span className={`border-b-2 border-current px-1 text-center leading-none ${large ? 'text-2xl pb-1' : 'text-lg'}`}>
        {numerator}
      </span>
      <span className={`text-center leading-none ${large ? 'text-2xl pt-1' : 'text-lg'}`}>
        {denominator}
      </span>
    </div>
  );
};