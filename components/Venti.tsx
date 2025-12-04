import React from 'react';

interface VentiProps {
  mood: 'happy' | 'thinking' | 'surprised' | 'neutral';
  message?: string;
}

export const Venti: React.FC<VentiProps> = ({ mood, message }) => {
  // Placeholder images using a stable placeholder service, colored to match mood
  // In a real app, these would be actual Venti assets.
  const getImageUrl = () => {
     // Using picsum as instructed, but adding a seed to keep it consistent-ish
     return `https://picsum.photos/seed/venti_${mood}/150/150`;
  };

  const getEmoji = () => {
      switch(mood) {
          case 'happy': return '🍃 ^_^';
          case 'thinking': return '🤔';
          case 'surprised': return '😯';
          default: return '🍃';
      }
  }

  return (
    <div className="flex flex-row items-start space-x-4 max-w-2xl w-full p-4 animate-fade-in-up">
      <div className="flex-shrink-0 relative">
        <div className="w-24 h-24 rounded-full border-4 border-anemo-400 overflow-hidden shadow-lg bg-white relative">
            <img src={getImageUrl()} alt="Venti" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center text-4xl select-none">
                {getEmoji()}
            </div>
        </div>
        <div className="absolute -bottom-2 -right-2 bg-anemo-600 text-white text-xs px-2 py-1 rounded-full shadow">
            温迪
        </div>
      </div>
      
      {message && (
        <div className="flex-1 bg-white rounded-2xl rounded-tl-none p-4 shadow-md border border-anemo-100 relative">
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
            {message}
          </p>
          <div className="absolute top-0 left-0 -ml-2 mt-4 w-0 h-0 border-t-[10px] border-t-transparent border-r-[10px] border-r-white border-b-[10px] border-b-transparent"></div>
        </div>
      )}
    </div>
  );
};