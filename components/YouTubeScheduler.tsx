
import React, { useState, useRef, useEffect } from 'react';

const parseYouTubeUrl = (url: string): { type: 'video' | 'playlist'; id: string } | null => {
  // Prioritize playlist URLs, as they can also contain a video ID.
  const playlistRegex = /[?&]list=([^#&?]+)/;
  const playlistMatch = url.match(playlistRegex);
  if (playlistMatch && playlistMatch[1]) {
    return { type: 'playlist', id: playlistMatch[1] };
  }

  // Fallback to checking for a video ID.
  const videoRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const videoMatch = url.match(videoRegex);
  if (videoMatch && videoMatch[1]) {
    return { type: 'video', id: videoMatch[1] };
  }

  return null;
};

const getDefaultShutdownTime = (): string => {
  const now = new Date();
  // Set default to 2 hours from now
  now.setHours(now.getHours() + 2);
  // Format to YYYY-MM-DDTHH:mm
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

type PlaybackState = 'idle' | 'playing' | 'finished';

interface YouTubeSchedulerProps {
  acquireLock: () => void;
  releaseLock: () => void;
}

export const YouTubeScheduler: React.FC<YouTubeSchedulerProps> = ({ acquireLock, releaseLock }) => {
  const [url, setUrl] = useState('');
  const [content, setContent] = useState<{ type: 'video' | 'playlist'; id: string } | null>(null);
  const [shutdownTime, setShutdownTime] = useState<string>(getDefaultShutdownTime());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [autoClose, setAutoClose] = useState(false);
  const [loop, setLoop] = useState(false);
  const timerRef = useRef<number | null>(null);
  const playerRef = useRef<any | null>(null); // To hold the YT.Player instance

  useEffect(() => {
    // This effect manages the YouTube player instance.
    // It creates a player when starting and destroys it when stopping.
    if (playbackState === 'playing' && content) {
      const createPlayer = () => {
        const playerConfig: any = {
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1, // Cleaner look
            rel: 0, // Don't show related videos at the end
          },
          events: {
            'onStateChange': (event: any) => {
              // @ts-ignore
              if (event.data === window.YT.PlayerState.PLAYING && timerRef.current) {
                // Update status when video starts playing successfully
                const shutdownDate = new Date(shutdownTime);
                const formattedTime = shutdownDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setStatusMessage(`Timer set. Playback will stop at ${formattedTime}.`);
              }
            },
            'onError': (event: any) => {
              const errorCode = event.data;
              // Error codes for unplayable videos: invalid param, html5 error, not found/private, not embeddable.
              const unplayableErrorCodes = [2, 5, 100, 101, 150];
              if (unplayableErrorCodes.includes(errorCode) && content?.type === 'playlist') {
                setStatusMessage('An unplayable video was skipped.');
                // event.target is the player instance.
                event.target.nextVideo();
              }
            }
          }
        };
        
        if (loop) {
            playerConfig.playerVars.loop = 1;
        }

        if (content.type === 'video') {
            playerConfig.videoId = content.id;
            if (loop) {
                // For a single video to loop, the 'playlist' param must also be set to the video ID.
                playerConfig.playerVars.playlist = content.id;
            }
        } else { // 'playlist'
            playerConfig.playerVars.listType = 'playlist';
            playerConfig.playerVars.list = content.id;
        }

        // @ts-ignore - YT is loaded from the script tag in index.html
        playerRef.current = new window.YT.Player('youtube-player-container', playerConfig);
      };

      // Ensure the YouTube IFrame API is ready before creating the player.
      // @ts-ignore
      if (window.YT && window.YT.Player) {
        createPlayer();
      } else {
        // If the API isn't ready, the global onYouTubeIframeAPIReady function will be called once it is.
        // @ts-ignore
        window.onYouTubeIframeAPIReady = createPlayer;
      }
    }

    // Cleanup function: This is crucial. It runs when the video should stop.
    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [playbackState, content, loop, shutdownTime]);

  useEffect(() => {
    // Cleanup timer on component unmount
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Setting state to idle ensures the old player is destroyed by the useEffect cleanup
    setPlaybackState('idle'); 
    releaseLock();

    const parsedContent = parseYouTubeUrl(url);
    if (!parsedContent) {
      setStatusMessage('Invalid YouTube URL. Please use a valid video or playlist URL.');
      setContent(null);
      return;
    }

    const shutdownDate = new Date(shutdownTime);
    const now = new Date();

    if (shutdownDate <= now) {
      setStatusMessage('Scheduled time must be in the future.');
      setContent(null);
      return;
    }
    
    setContent(parsedContent);
    setPlaybackState('playing'); // This will trigger the useEffect to create a new player
    acquireLock();

    setStatusMessage('Loading player and starting timer...');
    const delay = shutdownDate.getTime() - now.getTime();
    
    timerRef.current = window.setTimeout(() => {
      setPlaybackState('finished'); // Triggers player cleanup
      releaseLock();

      const formattedTime = new Date(shutdownTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (autoClose) {
        // Wait for the next event loop tick to ensure React has processed state changes
        setTimeout(() => {
            // First, attempt to close the window.
            window.close();

            // If window.close() fails (due to browser security), the script continues.
            // We replace the entire page content with a "safe to close" message
            // to avoid a blank white screen and provide a better UX.
            document.body.innerHTML = `
              <div style="background-color: #0f172a; color: #cbd5e1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center; padding: 2rem;">
                <h1 style="font-size: 2.25rem; font-weight: bold; color: #f8fafc; margin-bottom: 1rem;">All Done!</h1>
                <p style="font-size: 1.125rem;">The video has stopped and the screen lock is released.</p>
                <p style="font-size: 1.125rem; margin-top: 0.5rem;">It is now safe to close this browser tab.</p>
              </div>
            `;
        }, 100);
      } else {
        setStatusMessage(`Scheduled time reached. Playback stopped at ${formattedTime}.`);
      }
    }, delay);
  };

  const handleCancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Changing state to 'idle' triggers the useEffect cleanup, stopping the video.
    setPlaybackState('idle');
    setStatusMessage('Playback and timer canceled.');
    releaseLock();
  };

  const handleReset = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setPlaybackState('idle');
    setUrl('');
    setContent(null);
    setStatusMessage(null);
    setShutdownTime(getDefaultShutdownTime());
    setAutoClose(false);
    setLoop(false);
    releaseLock();
  };

  const renderContent = () => {
    switch (playbackState) {
      case 'playing':
        return (
          <div className="w-full space-y-4">
            <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
              {/* This div is the container where the YouTube player will be injected */}
              <div id="youtube-player-container" className="w-full h-full"></div>
            </div>
            <button
              onClick={handleCancel}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-full transition-all duration-300 ease-in-out"
              aria-label="Stop playback and cancel timer"
            >
              Stop Playback & Cancel Timer
            </button>
          </div>
        );
      case 'finished':
        return (
           <div className="w-full space-y-4">
            <div className="aspect-video w-full bg-black rounded-lg flex flex-col items-center justify-center text-white p-4">
              <h3 className="text-2xl font-bold mb-2">Playback Finished</h3>
              <p className="text-slate-300">This is your cue to stop screen sharing.</p>
            </div>
            <button
              onClick={handleReset}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-4 rounded-full transition-all duration-300 ease-in-out"
              aria-label="Schedule another video or playlist"
            >
              Schedule Another
            </button>
          </div>
        );
      case 'idle':
      default:
        return (
          <form onSubmit={handleSchedule} className="w-full space-y-4">
            <div>
              <label htmlFor="youtube-url" className="block text-sm font-medium text-slate-300 mb-1 text-left">YouTube Video or Playlist URL</label>
              <input
                type="url"
                id="youtube-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or /playlist?list=..."
                required
                className="w-full bg-slate-700 text-white rounded-md px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label htmlFor="shutdown-time" className="block text-sm font-medium text-slate-300 mb-1 text-left">Stop Playback At</label>
              <input
                type="datetime-local"
                id="shutdown-time"
                value={shutdownTime}
                onChange={(e) => setShutdownTime(e.target.value)}
                required
                className="w-full bg-slate-700 text-white rounded-md px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="space-y-4 pt-2 text-left">
              <div className="relative flex items-start">
                  <div className="flex h-6 items-center">
                      <input
                          id="loop-playback"
                          aria-describedby="loop-playback-description"
                          name="loop-playback"
                          type="checkbox"
                          checked={loop}
                          onChange={(e) => setLoop(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-800"
                      />
                  </div>
                  <div className="ml-3 text-sm leading-6">
                      <label htmlFor="loop-playback" className="font-medium text-slate-300">
                          Loop Playback
                      </label>
                      <p id="loop-playback-description" className="text-slate-500">Continuously replay the video or playlist.</p>
                  </div>
              </div>
              <div className="relative flex items-start">
                  <div className="flex h-6 items-center">
                      <input
                          id="auto-close"
                          aria-describedby="auto-close-description"
                          name="auto-close"
                          type="checkbox"
                          checked={autoClose}
                          onChange={(e) => setAutoClose(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-800"
                      />
                  </div>
                  <div className="ml-3 text-sm leading-6">
                      <label htmlFor="auto-close" className="font-medium text-slate-300">
                          Auto-close tab when timer ends
                      </label>
                      <p id="auto-close-description" className="text-slate-500">
                          Note: Browser security may prevent this.
                      </p>
                  </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-4 rounded-full transition-all duration-300 ease-in-out transform hover:scale-105"
            >
              Load & Start Timer
            </button>
          </form>
        );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-800 rounded-2xl shadow-2xl p-8 text-center flex flex-col items-center border border-slate-700">
      <header className="w-full mb-4">
        <h2 className="text-2xl font-bold text-slate-100">YouTube Shutdown Timer</h2>
        <p className="text-sm text-slate-400 mt-1 h-10">
          Play a video or playlist and set a time for it to automatically stop. Perfect for presentations.
        </p>
      </header>
      
      {renderContent()}

      {statusMessage && (
        <p className="text-sm text-slate-400 mt-4 h-5">{statusMessage}</p>
      )}
    </div>
  );
};
