
import React from 'react';

interface InstructionCardProps {
  isSupported: boolean;
  error: string | null;
}

export const InstructionCard: React.FC<InstructionCardProps> = ({ isSupported, error }) => {
  return (
    <div className="w-full mt-8 p-4 bg-slate-900/50 rounded-lg border border-slate-700 text-sm text-slate-400 text-left">
      {error && (
         <div className="p-3 mb-4 bg-red-900/50 border border-red-500/50 rounded-md text-red-300" role="alert">
            <strong className="font-semibold">Error Encountered:</strong>
            <p className="mt-1">{error}</p>
         </div>
      )}
      <h3 className="font-bold text-slate-200 mb-2">How it works:</h3>
      <ul className="list-disc list-inside space-y-2">
        <li>The screen lock will activate automatically when you start playing a video in the YouTube timer below.</li>
        <li>This is perfect for keeping your screen on during long videos, music playlists, video calls, or while following a recipe.</li>
        <li>The lock is automatically released if you stop the video, navigate away, or close this page.</li>
        {!error && (
          isSupported ? (
              <li>Your browser supports this feature. You're good to go!</li>
          ) : (
              <li className="text-amber-400">Your browser does not support the Screen Wake Lock API. Please try a modern browser like Chrome, Edge, or Opera.</li>
          )
        )}
      </ul>
    </div>
  );
};
