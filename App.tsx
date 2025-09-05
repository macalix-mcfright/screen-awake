
import React from 'react';
import { useWakeLock } from './hooks/useWakeLock';
import { CoffeeIcon } from './components/CoffeeIcon';
import { StatusIndicator } from './components/StatusIndicator';
import { InstructionCard } from './components/InstructionCard';
import { YouTubeScheduler } from './components/YouTubeScheduler';

const App: React.FC = () => {
  const { isSupported, isActive, error, acquireLock, releaseLock } = useWakeLock();

  return (
    <main className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-md mx-auto space-y-8">
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 text-center flex flex-col items-center border border-slate-700">
          <header className="mb-6">
            <CoffeeIcon className="h-16 w-16 mx-auto text-amber-400" />
            <h1 className="text-4xl font-bold text-slate-100 mt-4">Screen Awake</h1>
            <p className="text-slate-400 mt-2">Prevent your device's screen from turning off.</p>
          </header>

          <div className="w-full my-4">
             <StatusIndicator isSupported={isSupported} isActive={isActive} error={error} />
          </div>

          <InstructionCard isSupported={isSupported} error={error} />

          <footer className="mt-8 text-xs text-slate-500">
            <p>Your screen will stay on as long as this page is visible and a video is playing.</p>
          </footer>
        </div>

        <YouTubeScheduler acquireLock={acquireLock} releaseLock={releaseLock} />

      </div>
    </main>
  );
};

export default App;