
import React, { useState, useRef, useEffect } from 'react';

const parseYouTubeVideoUrl = (url: string): string | null => {
  // Regex to find a video ID from various YouTube URL formats.
  const videoRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const videoMatch = url.match(videoRegex);
  if (videoMatch && videoMatch[1]) {
    return videoMatch[1];
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
type PlaylistItem = { id: string; url: string };

interface YouTubeSchedulerProps {
  acquireLock: () => void;
  releaseLock: () => void;
}

export const YouTubeScheduler: React.FC<YouTubeSchedulerProps> = ({ acquireLock, releaseLock }) => {
  const [url, setUrl] = useState('');
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [shutdownTime, setShutdownTime] = useState<string>(getDefaultShutdownTime());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [autoClose, setAutoClose] = useState(false);
  const [loop, setLoop] = useState(false);
  const timerRef = useRef<number | null>(null);
  const playerRef = useRef<any | null>(null); // To hold the YT.Player instance
  const [currentlyPlayingIndex, setCurrentlyPlayingIndex] = useState<number | null>(null);

  useEffect(() => {
    // This effect manages the YouTube player instance.
    if (playbackState === 'playing' && playlist.length > 0) {
      const createPlayer = () => {
        const playerConfig: any = {
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            'onReady': (event: any) => {
                if (playlist.length > 1) {
                  const videoIds = playlist.map(video => video.id);
                  event.target.loadPlaylist(videoIds);
                  if (loop) {
                      event.target.setLoop(true);
                  }
                } else {
                   event.target.loadVideoById(playlist[0].id);
                }
            },
            'onStateChange': (event: any) => {
              // @ts-ignore
              if (event.data === window.YT.PlayerState.PLAYING) {
                if (timerRef.current) { // Check if timer is active
                    const shutdownDate = new Date(shutdownTime);
                    const formattedTime = shutdownDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    setStatusMessage(`Timer set. Playback will stop at ${formattedTime}.`);
                }
                const newIndex = playlist.length > 1 ? event.target.getPlaylistIndex() : 0;
                setCurrentlyPlayingIndex(newIndex);
              }
            },
            'onError': (event: any) => {
              const errorCode = event.data;
              const unplayableErrorCodes = [2, 5, 100, 101, 150];
              if (unplayableErrorCodes.includes(errorCode)) {
                setStatusMessage('An unplayable video was skipped.');
                if (playlist.length > 1) {
                    event.target.nextVideo();
                }
              }
            }
          }
        };

        // @ts-ignore - YT is loaded from the script tag in index.html
        playerRef.current = new window.YT.Player('youtube-player-container', playerConfig);
      };

      // Ensure the YouTube IFrame API is ready.
      // @ts-ignore
      if (window.YT && window.YT.Player) {
        createPlayer();
      } else {
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
  }, [playbackState, playlist, loop, shutdownTime]);

  useEffect(() => {
    // Cleanup timer on component unmount
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = parseYouTubeVideoUrl(url);
    if (!videoId) {
        setStatusMessage('Invalid YouTube video URL.');
        return;
    }
    if (playlist.some(v => v.id === videoId)) {
        setStatusMessage('This video is already in the playlist.');
        return;
    }
    setPlaylist(prev => [...prev, { id: videoId, url: url }]);
    setUrl('');
    setStatusMessage('Video added to playlist.');
  };

  const handleRemoveVideo = (idToRemove: string) => {
    setPlaylist(prev => prev.filter(video => video.id !== idToRemove));
  };

  const handleSchedule = () => {
    if (playlist.length === 0) {
      setStatusMessage('Please add at least one video.');
      return;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const shutdownDate = new Date(shutdownTime);
    const now = new Date();

    if (shutdownDate <= now) {
      setStatusMessage('Scheduled time must be in the future.');
      return;
    }
    
    setPlaybackState('playing');
    acquireLock();

    setStatusMessage('Loading player and starting timer...');
    const delay = shutdownDate.getTime() - now.getTime();
    
    timerRef.current = window.setTimeout(() => {
      setPlaybackState('finished');
      releaseLock();

      const formattedTime = new Date(shutdownTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (autoClose) {
        setTimeout(() => {
            window.close();
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
    setPlaylist([]);
    setCurrentlyPlayingIndex(null);
    setStatusMessage(null);
    setShutdownTime(getDefaultShutdownTime());
    setAutoClose(false);
    setLoop(false);
    releaseLock();
  };

  const renderContent = () => {
    switch (playbackState) {
      case 'playing':
        const isPlaylist = playlist.length > 1;
        const isRadioMode = playlist.length === 1;

        return (
          <div className="w-full space-y-4">
            <div className={`w-full ${isPlaylist ? 'flex flex-col md:flex-row gap-4' : ''}`}>
              <div className={`aspect-video bg-black rounded-lg overflow-hidden ${isPlaylist ? 'flex-grow w-full md:w-2/3' : 'w-full'}`}>
                <div id="youtube-player-container" className="w-full h-full"></div>
              </div>

              {isPlaylist && (
                <div className="w-full md:w-1/3 bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                  <h3 className="text-lg font-bold text-slate-100 mb-2">Playlist</h3>
                  <ul className="space-y-2 max-h-64 md:max-h-80 overflow-y-auto pr-2">
                    {playlist.map((video, index) => (
                      <li key={video.id}>
                        <button
                          onClick={() => playerRef.current?.playVideoAt(index)}
                          className={`w-full text-left p-2 rounded-md transition-colors ${currentlyPlayingIndex === index ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                          title={video.url}
                        >
                          <span className="font-semibold block truncate">
                            {`Track ${index + 1}`}
                          </span>
                          <span className="text-xs block truncate opacity-70">{video.url}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {isRadioMode && (
              <p className="text-sm text-slate-400 -mt-2">
                Radio mode is active. Related videos will play automatically.
              </p>
            )}

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
          <div className="w-full space-y-4">
            <form onSubmit={handleAddVideo} className="w-full">
                <label htmlFor="youtube-url" className="block text-sm font-medium text-slate-300 mb-1 text-left">Add YouTube Video URL</label>
                <div className="flex gap-2">
                    <input
                        type="url"
                        id="youtube-url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        required
                        className="flex-grow bg-slate-700 text-white rounded-md px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button type="submit" className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-md transition-colors">
                        Add
                    </button>
                </div>
            </form>

            {playlist.length > 0 && (
                <div className="w-full text-left p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                    <h3 className="font-bold text-slate-200 mb-2">Current Playlist ({playlist.length})</h3>
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {playlist.map((video, index) => (
                        <li key={video.id} className="flex items-center justify-between bg-slate-700 p-2 rounded-md">
                          <span className="text-slate-300 text-sm truncate flex-grow mr-2" title={video.url}>
                            {`${index + 1}. ${video.url}`}
                          </span>
                          <button
                            onClick={() => handleRemoveVideo(video.id)}
                            className="text-red-400 hover:text-red-300 font-bold text-xl ml-2 px-2 flex-shrink-0"
                            aria-label={`Remove ${video.url} from playlist`}
                          >
                            &times;
                          </button>
                        </li>
                      ))}
                    </ul>
                </div>
            )}

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
                          Loop Playlist
                      </label>
                      <p id="loop-playback-description" className="text-slate-500">Continuously replay the entire playlist.</p>
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
              type="button"
              onClick={handleSchedule}
              disabled={playlist.length === 0}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-4 rounded-full transition-all duration-300 ease-in-out transform hover:scale-105 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none"
            >
              Load Playlist & Start Timer
            </button>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 text-center flex flex-col items-center border border-slate-700">
      <header className="w-full mb-4">
        <h2 className="text-2xl font-bold text-slate-100">YouTube Shutdown Timer</h2>
        <p className="text-sm text-slate-400 mt-1 h-10">
          Build a playlist or start a radio session, and set a time for it to automatically stop.
        </p>
      </header>
      
      {renderContent()}

      {statusMessage && (
        <p className="text-sm text-slate-400 mt-4 h-5">{statusMessage}</p>
      )}
    </div>
  );
};