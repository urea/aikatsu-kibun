
import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';

// A custom hook to manage state with localStorage persistence
function useLocalStorageState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.error(`Error setting localStorage key “${key}”:`, error);
      }
    }
  }, [key, state]);

  return [state, setState];
}


// A reusable arcade-style button component
const ArcadeButton: React.FC<{
  color: 'red' | 'green' | 'yellow';
  isPressed: boolean;
  onPress: () => void;
  onRelease: () => void;
  ariaLabel: string;
}> = ({ color, isPressed, onPress, onRelease, ariaLabel }) => {

  const colorClasses = {
    red: {
      bg: 'bg-red-500',
      gradient: 'from-red-400 to-red-600',
      glow: 'focus:ring-red-400',
      pressed: 'scale-105 brightness-150 shadow-[0_0_35px_10px] shadow-red-400/80',
    },
    green: {
      bg: 'bg-green-500',
      gradient: 'from-green-400 to-green-600',
      glow: 'focus:ring-green-400',
      pressed: 'scale-105 brightness-150 shadow-[0_0_35px_10px] shadow-green-400/80',
    },
    yellow: {
      bg: 'bg-yellow-400',
      gradient: 'from-yellow-300 to-yellow-500',
      glow: 'focus:ring-yellow-300',
      pressed: 'scale-105 brightness-150 shadow-[0_0_35px_10px] shadow-yellow-400/80',
    },
  };

  const classes = colorClasses[color];

  return (
    <button
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      onTouchStart={(e) => { e.preventDefault(); onPress(); }}
      onTouchEnd={(e) => { e.preventDefault(); onRelease(); }}
      aria-label={ariaLabel}
      className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-full font-bold text-white transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 transform
        ${classes.glow}
        ${classes.bg}
        ${isPressed ? classes.pressed : 'shadow-lg'}
      `}
    >
      <span className={`absolute inset-0 rounded-full bg-gradient-to-br ${classes.gradient} opacity-80 mix-blend-lighten transition-opacity duration-200 ${isPressed ? 'opacity-100' : ''}`}></span>
      <span className="absolute inset-3 sm:inset-4 rounded-full bg-black/20 blur-md"></span>
    </button>
  );
};

type SoundType = 'tick';
type ButtonColor = 'red' | 'green' | 'yellow';

const playTickSound = (context: AudioContext) => {
    const now = context.currentTime;
    const duration = 0.03;
    const osc = context.createOscillator();
    const gainNode = context.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);

    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(now);
    osc.stop(now + duration);
};

export type GameControlsHandle = {
  pressButton: (color: ButtonColor) => void;
  releaseButton: (color: ButtonColor) => void;
};

// The component that groups the arcade buttons
const GameControls = forwardRef<GameControlsHandle, { soundType: SoundType }>(({ soundType }, ref) => {
  const [pressedState, setPressedState] = useState({ red: false, green: false, yellow: false });
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundIntervalRef = useRef<{ [key: string]: number | null }>({});

  useEffect(() => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);

  const playSound = useCallback(() => {
    const context = audioContextRef.current;
    if (!context) return;
    
    if (context.state === 'suspended') {
        context.resume();
    }
    
    playTickSound(context);
  }, []);

  const handlePress = useCallback((color: ButtonColor) => {
    if (pressedState[color]) return;

    setPressedState(prevState => ({ ...prevState, [color]: true }));

    if (soundIntervalRef.current[color]) {
      clearInterval(soundIntervalRef.current[color]!);
    }
    playSound();
    
    soundIntervalRef.current[color] = setInterval(playSound, 40);
  }, [playSound, pressedState]);

  const handleRelease = useCallback((color: ButtonColor) => {
    if (!pressedState[color]) return;
      
    setPressedState(prevState => ({ ...prevState, [color]: false }));

    if (soundIntervalRef.current[color]) {
      clearInterval(soundIntervalRef.current[color]!);
      soundIntervalRef.current[color] = null;
    }
  }, [pressedState]);
  
  useImperativeHandle(ref, () => ({
    pressButton(color: ButtonColor) {
      handlePress(color);
    },
    releaseButton(color: ButtonColor) {
      handleRelease(color);
    },
  }));

  return (
    <div className="mt-8 flex flex-col items-center justify-center" role="group" aria-label="Game Controls">
        <div className="mb-6">
            <ArcadeButton color="red" isPressed={pressedState.red} onPress={() => handlePress('red')} onRelease={() => handleRelease('red')} ariaLabel="Red Button (W key)" />
        </div>
        <div className="flex gap-10 sm:gap-16">
            <ArcadeButton color="green" isPressed={pressedState.green} onPress={() => handlePress('green')} onRelease={() => handleRelease('green')} ariaLabel="Green Button (A key)" />
            <ArcadeButton color="yellow" isPressed={pressedState.yellow} onPress={() => handlePress('yellow')} onRelease={() => handleRelease('yellow')} ariaLabel="Yellow Button (D key)" />
        </div>
    </div>
  );
});

type Video = { id: string; title: string; thumbnailUrl: string };

const ConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
            <div className="bg-white dark:bg-rose-900 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h3 id="confirmation-title" className="text-lg font-bold text-rose-900 dark:text-rose-100">{title}</h3>
                    <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{message}</p>
                </div>
                <div className="bg-gray-50 dark:bg-rose-800/50 px-6 py-3 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-rose-700 border border-gray-300 dark:border-rose-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        リセット
                    </button>
                </div>
            </div>
        </div>
    );
};

const VideoSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    videos: Video[];
    onSelectVideo: (id: string) => void;
    favoriteIds: string[];
    onToggleFavorite: (id: string) => void;
    onAddVideo: (url: string) => Promise<void>;
    onResetFavorites: () => void;
    onResetUserVideos: () => void;
    isFavoritesResettable: boolean;
    isUserVideosResettable: boolean;
}> = ({ 
    isOpen, onClose, videos, onSelectVideo, favoriteIds, onToggleFavorite, onAddVideo,
    onResetFavorites, onResetUserVideos, isFavoritesResettable, isUserVideosResettable
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [isAddingVideo, setIsAddingVideo] = useState(false);
    const [inputError, setInputError] = useState<string | null>(null);
    const [confirmModalState, setConfirmModalState] = useState<{
        isOpen: boolean;
        action: 'reset-favorites' | 'reset-user-videos' | null;
        title: string;
        message: string;
    }>({ isOpen: false, action: null, title: '', message: '' });

    const filteredVideos = useMemo(() => {
        if (!searchTerm.trim()) {
            return videos;
        }
        return videos.filter(video =>
            video.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [videos, searchTerm]);

    const handleAddVideo = async () => {
        setIsAddingVideo(true);
        setInputError(null);
        try {
            await onAddVideo(urlInput);
            setUrlInput('');
        } catch (error: any) {
            setInputError(error.message);
        } finally {
            setIsAddingVideo(false);
        }
    };
    
    const handleFavoritesResetClick = () => {
        setConfirmModalState({
            isOpen: true,
            action: 'reset-favorites',
            title: 'お気に入りのリセット',
            message: 'お気に入りをすべてリセットしますか？この操作は元に戻せません。',
        });
    };

    const handleUserVideosResetClick = () => {
        setConfirmModalState({
            isOpen: true,
            action: 'reset-user-videos',
            title: '追加動画のリセット',
            message: '追加した動画をすべてリセットしますか？この操作は元に戻せません。',
        });
    };

    const handleConfirmReset = () => {
        if (confirmModalState.action === 'reset-favorites') {
            onResetFavorites();
        } else if (confirmModalState.action === 'reset-user-videos') {
            onResetUserVideos();
        }
        setConfirmModalState({ isOpen: false, action: null, title: '', message: '' });
    };

    const handleCancelReset = () => {
        setConfirmModalState({ isOpen: false, action: null, title: '', message: '' });
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
                <div className="bg-white dark:bg-rose-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <header className="p-4 border-b border-pink-200 dark:border-rose-700 flex justify-between items-center flex-shrink-0">
                        <h2 className="text-xl font-bold text-rose-800 dark:text-rose-200">動画を選択</h2>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleFavoritesResetClick} 
                                disabled={!isFavoritesResettable}
                                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-rose-700 dark:text-rose-300 bg-pink-100 dark:bg-rose-700 rounded-md hover:bg-pink-200 dark:hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="お気に入りをリセット"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                               <span>お気に入りリセット</span>
                            </button>
                            <button 
                                onClick={handleUserVideosResetClick}
                                disabled={!isUserVideosResettable}
                                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-rose-700 dark:text-rose-300 bg-pink-100 dark:bg-rose-700 rounded-md hover:bg-pink-200 dark:hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="追加動画をリセット"
                            >
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                               <span>追加動画リセット</span>
                            </button>
                            <button onClick={onClose} className="p-2 rounded-full text-rose-500 dark:text-rose-400 hover:bg-pink-200 dark:hover:bg-rose-700" aria-label="閉じる">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </header>
                    <div className="p-4 flex-shrink-0">
                        <div className="mb-4">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="動画タイトルで検索..."
                                className="block w-full rounded-md border-pink-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 dark:bg-rose-700 dark:border-rose-600 dark:text-rose-200 dark:placeholder-rose-400"
                            />
                        </div>
                        <div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="YouTubeのURLで追加..."
                                    className="flex-grow block w-full rounded-md border-pink-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 dark:bg-rose-700 dark:border-rose-600 dark:text-rose-200 dark:placeholder-rose-400"
                                    disabled={isAddingVideo}
                                />
                                <button
                                    onClick={handleAddVideo}
                                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
                                    disabled={isAddingVideo || !urlInput.trim()}
                                >
                                    {isAddingVideo ? '追加中...' : '追加'}
                                </button>
                            </div>
                            {inputError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{inputError}</p>}
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto px-4 pb-4">
                        {filteredVideos.length > 0 ? (
                            <ul className="space-y-2">
                                {filteredVideos.map((video) => {
                                    const isFavorite = favoriteIds.includes(video.id);
                                    return (
                                        <li key={video.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-pink-100 dark:hover:bg-rose-700 transition-colors">
                                            <button onClick={() => onSelectVideo(video.id)} className="flex items-center gap-3 flex-grow text-left">
                                                <img src={video.thumbnailUrl} alt={video.title} className="w-24 aspect-video object-cover rounded-md flex-shrink-0" />
                                                <span className="text-sm font-medium text-rose-800 dark:text-rose-200">{video.title}</span>
                                            </button>
                                            <button onClick={() => onToggleFavorite(video.id)} className="p-2 rounded-full text-rose-400 hover:text-amber-500 transition-colors flex-shrink-0" aria-label={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-center text-rose-500 dark:text-rose-400 mt-8">該当する動画が見つかりません。</p>
                        )}
                    </div>
                </div>
            </div>
            <ConfirmationModal 
                isOpen={confirmModalState.isOpen}
                onClose={handleCancelReset}
                onConfirm={handleConfirmReset}
                title={confirmModalState.title}
                message={confirmModalState.message}
            />
        </>
    );
};


const FavoritesCarousel: React.FC<{
    videos: Video[];
    onSelectVideo: (id: string) => void;
    currentVideoId: string;
}> = ({ videos, onSelectVideo, currentVideoId }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    const checkArrows = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        setShowLeftArrow(el.scrollLeft > 0);
        setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth -1);
    }, []);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() => checkArrows());
        observer.observe(el);
        checkArrows();
        return () => observer.disconnect();
    }, [videos, checkArrows]);

    const handleScroll = (direction: 'left' | 'right') => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const scrollAmount = el.clientWidth * 0.8;
        el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    };

    if (videos.length === 0) {
        return (
            <div className="text-center py-8 px-4 rounded-lg bg-pink-100 dark:bg-rose-800">
                <p className="text-rose-500 dark:text-rose-400">星マーク（☆）を押してお気に入りを追加すると、ここに表示されます。</p>
            </div>
        );
    }
    
    return (
         <div className="relative">
            {showLeftArrow && (
                 <button onClick={() => handleScroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 bg-white/80 dark:bg-rose-800/80 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center shadow-lg" aria-label="左にスクロール">
                    &lt;
                </button>
            )}
            <div
                ref={scrollContainerRef}
                onScroll={checkArrows}
                className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
            >
                {videos.map((video) => (
                    <button
                        key={video.id}
                        onClick={() => onSelectVideo(video.id)}
                        className={`
                          flex-shrink-0 w-48 text-left rounded-lg overflow-hidden border-4 transition-all duration-200 bg-white dark:bg-rose-800
                          ${currentVideoId === video.id ? 'border-indigo-500 shadow-xl scale-105' : 'border-transparent hover:border-indigo-400/50 dark:hover:border-indigo-600/50 hover:shadow-lg hover:-translate-y-1'}
                        `}
                    >
                        <img src={video.thumbnailUrl} alt={video.title} className="w-full object-cover aspect-video" />
                        <div className="p-2">
                            <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-200 truncate leading-tight">{video.title}</h3>
                        </div>
                    </button>
                ))}
            </div>
            {showRightArrow && (
                 <button onClick={() => handleScroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-white/80 dark:bg-rose-800/80 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center shadow-lg" aria-label="右にスクロール">
                    &gt;
                </button>
            )}
        </div>
    );
};


const App: React.FC = () => {
  const [theme, setTheme] = useLocalStorageState<'light' | 'dark'>('theme', 
    (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
  );

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const initialVideoIds = useMemo(() => Array.from(new Set([
    'tsKd6HdXvso', 'RjGv7Sa4YQo', '4z31xQuGTp4', '3qqJ1WpF1Cg', 'uISk1HrbFzA', 'q5d60AsaN98', 'Wy_pD0JgHR4',
    '2BN2jH1zlUA', 'bBYYGWyi_Ig', 'aKPhl4S91mM', 'ZCEXyMPKWhA', '7fJuYvx3ou0', '2t0vIcfvEeY', 'uPVjCDbc-Ow',
    'uRcy4Aj4B8w', 'BZqKDdCoTZM', 'HcHpQ_qj6WQ', 'en95U1lK2EQ', 'LQa1mIGbV1c', '72xB_012eVY', '3gVFHFm9Gxw',
    'xiXCHkBaOCg', 'ZbgdnKbyFSo', 'BoE8mVhNjO0', '6beo8GHes4U', '4H4ID0eHREE', 'jmKak1vq1Go', 'Ogu6EGNumKI',
    'N1W9IzcJ8Ug', 'pYT8w_qP6ro', 'gVw3xo5Uf-8', 'KLLJJIs9_7s', 'KATAtxUEEy4', 'RVZCWJ8XuhI', 'sRfanR9ZZ0U',
    'iXr5sT3PFKg', 'NmZm5YQf8l0', 'GlgVZ5Z76-M', '1wMEC1WZLts', 'qs4FOgqvTj0', 'lHrI8DmPCac', 'ULY7WX4_Sd8',
    'MpffoNUUGx8', 'KkPGFKp0gXA', 'pJEKdGGQXdo', '_yyszvUE4r8', 'FPSmZacW_UA', 'hwuuwNyRcKI', '-Xh9NYCRw0M',
    '9w_utuMvfOc', 'SvFOQobTzk0', 'xhBY87NDwrE', '6IEVhN5zJC0', 'VxQ4wn8cGyA', 'op0UXD2l55g', 'oj9dwIkLI_4',
    'oTME3Ur1-ak', 'w2DOYY1mFrg', 'clq4pdBCtTY', '5u5Nc1UWXgg', 'RuKpbA9RSGw', 'M4r1vx2ofUQ', 'AEMsMi7n5x8',
    'BKdhQ8GTjbU', 'n8cEgbNzGPc', 'lODsTsWgyg4', 'cNrttb3MPlY', '0GxDua-0G98', '-YAB0CUxkPE', 'Pu0wYH4CU4E',
    'cwZBNZkF4UQ', 'ujWIfR_rwIg', 'x2Po_BZM_uI', 'tezg1gSJbdo', 'VLIHkj5TrlY', 'PdOakkv6I1w', 'KBWyBfdYy5w',
    'EpSXZjzrUkg', 'OUj4Q8qx1ZQ', '1meOdSe6XTQ', 'Vh2KJq-lyLk', '5dRbGrDWIOU', '4SR6G0eoDPs', '1Jy-KfZwCeA',
    'jIRuoBkjltc', 'UNwx5x2NM9A', 'wDcemF2c3Ro', 'M73DLRbfn_c', '2pAT2OBDXXk', 'yp8Jhjt_png', 'fcPc573QgjU',
    'EOAzGVIzo7U', 'S3bGcj2Rm5o', 'rqqKNukafX0', 'EShAj8OeknA', 'tRx-ayAnRXA', 'p3lVBD4ei6k', 'WLnv4MwbumM',
    'F8V90FkxIZU', 'qpjQ6ZmhDCo', 'nC7OrqXYc6k', 'huFkGmp6eaw', 'cEO4Z7lq-q8', 'LzlDy5edLzo', 'IoK9hnz8cOs',
    '4wEIAGRAxHw', '1xwXyuePSak', 'ql5bm1VU7oQ', 'RfwQteCBfYw', 'fMz6hOoGHHU', 'XzezA5Icqoo', 'WO9D0IKmnX0',
    '9f6_hQtkQsA', '9JQFov6GazM', '8wKDBiD4XsA', 'uXhyoPjNmaw', 'iqRMeq9ajZE', 'fxBWfBLLlU', 'XTSgskSDKEw',
    'WkcqB18K60c', 'TrTFIr8f-n0', 'NLi86WxjPvs', 'MXOBWa1DLCw', 'tfAep2L872E', 'itWdwzWn0Sk', 'z8_cmTbrlNw',
    'xE_Z_Ph7fYk', 'wfqZHr40e0k', 'uepx-pu_IOI', 'r3ZOW5AQRis', 'oo6cucd8FGY', 'mNCv-dmYPS8', 'ltcZaHcarug',
    'h0kOl31dJoM', 'fXluHhS6IGQ', 'f9eRf6ccrAs', 'bWDAyRa6rGU', 'a86i2NFElAk', 'TX414PPKQTA', 'QqJs_d5PWzw',
    'KsORl3_jgMQ', 'KIKPbfhYxPY', 'ItzPBWP614E', 'I8rX7mfQd90', 'HvtKsOu48JU', 'GtXHDzY1yCA', 'DjraTjOS0c4',
    'BDu-c8m3Elo', '9-ITMd0_Hmc', '3lFpoJyNmSs', '3ULbpMIz32w', 'Q1zHZ_5WoQo', 'm0FGgFsMpNc', 'K2uy7wGFFgw',
    '1x9rWKtrn9Y', 'Vnobd_FDp48', 'H5miyoLIaGk', 'ZLIqln6BSGI', 'Oqepld-YRaE', 'i_NnjpotJ5M', '5r3snDugV8M',
    'zv7he_TKHpg', 'q2tjrV2JiZY', 'kibfnTlnKBs', 'hihAM-CQyzM', 'cYstuM4CYsU', 'mkdEmQ5RttE', 'XO_2jNhCqTw',
    'VWrSZ8BjIyA', 'KbYs5YYUK7I', '2ZNxFC--4fE', 'qJ3YJ4eywvY', '1vYteBXaOyI', 'lsFTKcP9EyA', 'bz6ejOvk2_U',
    'vHnENRwluK0', 'htnIF4hkZ40', 'lZ_3EU7X3yA', 'PUR0XbH4LrQ', 'Foyc6FTiRnA', 'oz9aqDD7F_c', 'uOSDgSH_T80',
    '22vPY_1OaLY', 'J_1DFaELLPU', 'THoRA3aT4og', 'SYEqF_FY5Qo', '_Vdv7TjMZzQ', 'LW9ho4Ftjh8', 'sLtVMfyuQfk',
    'AyNw00TNrCA', 'cvArV6EOysI', 'm3zcqWEBrI4', 'YPxyfDqAmYU', 'o545mbzprw4', 'O5BisaR_30Y', 'FyG3JM9_Ga0',
    'BaMR9ZcA8NU', 'AiWGcDOnFhM', 'o3IYLSbYac4', 'cvy9ts-rNTE', 'KS83f4N0pwU', 'CJUtJQ1rzg4', 'slnfBIWMni4',
    'WdpK14OXYB4', '0sZE4i8Y7k4', 'hF6YDrfCqbQ', 'dYVD26j9ZSc', 'bu5dmV11-ok', 'bh3QyscC4z4', '4KtjvHTq5jY',
    'nGpwaZusSmc', '6uduAQx_HKA', 'KRYSa79bbQE', 'Pd1Z0wX93cE', 'zOuIiDw9K_A', 'c7HeTKiV4-Y', 'tDv6rkHgV9k',
    'FAf3MKuOgGE', 'nSQYIQA6rB8', 'hUc05yg7RYM', 'dirjw0TRnJE', 'WKsfqws2NOs', 'VwZ0bzDVIMo', 'zQSZpeuS3x0',
    'SxR-zqtIg0A', 'CQYcrKCjxlI', 'wKtiP2V9yr0', 'o7JY84_bMHQ', 'sZbyRDGAOD0', 'kl6mUw3zIbE', 'A32dkTeVQwA',
    'z8ay9dAhyFg', '862yM3gCsuY', 'IOVtbv7ZEjU', 'Tn6mOEL1zJ0', 'wctOLFXwRg4', 'wPiw_E_1WBg', '9TJg8_FtCOQ',
    'vyvXYaF0a04', 'Wsr3K2GZfys', 'RYmw8Et5riA', '3iy5PjmSPNM', 'sO7NArY8qhw', 'fGdLUtMch5c', 'j9nIpp9l99w',
    'e86X5ipmG9U', 'imVC38JopIU', 'R1TEBqAnkMU', 'MwvlyT0O9xE', 'xzss0RaYK18', 'xHvKyrvQhu8', 'c8SNAvOvOOM',
    'vg8EntypJ8c', 'cMQAbcUz20g', 'dUMxFQeFFbI', 'wZWiZD4etXI', 'r9fnpDxkCH8', 'vKRBn9de308', 'd7AWyGroqxk',
    'De3tjz6BhHY', 'ByG2m8Rxx60', 'yh5nPYJR2Es', 'DC0YU_-t0y4', 'LqD2vAtHy10', 'B7DyC125qks', 'DMhXbYkz4FQ',
    '4ZGQMqSWKfw', 'bpmWBZqPl_U', '0hJperuzZ_M', 'xcsQsXU6Rj8', 'B6l3x2XrK6w', '0t0VGl6uu5k', 'lHVf_1O4AII',
    'RbyZQyiFFco', 'LMEzfV068a4', 'pn8YwQlJuyU', '-hyVsOSSPbw', '22wYlpKWqC8', 'nwuC2NSyixg', 'km0hHCZp5RY',
    'hropvmRz0_M', 'uWvlOqpAbMM', 'xb639LdgDpw', '4wignYcpqe8', 'RJTrTeEObog', 'xh_360kVOF4', 'PMpfH86vnNM',
    'EvIyzjlyH_0', 'B8tgwNoJ_8A', 'oUNR-I5V8rQ', 'b4xLiGq72AM', 'SEL5D6ya14M', '2qfgRuoMpcE', 'plFa4paRLdA',
    'ceCioX0LYU0', 'vPWL8vYPHNM', '2hYr422h1wo', 'YLn9COaWyog', 'mAwLMgpSBAQ', 'VqZUUQ0KVqw', 'S3twekqjVQc',
    'rQ19M5WXmbA', 'ixRp65POU7k', 'NzpBaiboVYU', '_5Y_mEzAOvI', 'rqt-LlEloKk', 'DEdbmXWokTI', 'VmL9z7AhPMQ',
    'UoEO_tK53ck','UXByUTuzQso', 'RuKpbA9RSGw', 'tZ-p6ff8s0Y', 'T460dxv4sNA', 'fQ2OExJkSjI'
  ])), []);

  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [videoId, setVideoId] = useState(() => {
    if (initialVideoIds.length === 0) return '';
    const randomIndex = Math.floor(Math.random() * initialVideoIds.length);
    return initialVideoIds[randomIndex];
  });
  const [isMuted, setIsMuted] = useState(true);
  const gameControlsRef = useRef<GameControlsHandle>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useLocalStorageState<string[]>('favoriteVideoIds', []);

  const favoriteVideos = useMemo(() => {
    const favoriteVideoMap = new Map(videos.map(v => [v.id, v]));
    return favoriteIds.map(id => favoriteVideoMap.get(id)).filter((v): v is Video => v !== undefined);
  }, [videos, favoriteIds]);

  const fetchVideoDetails = useCallback(async (ids: string[]): Promise<Video[]> => {
      try {
        const videoDataPromises = ids.map(async (id) => {
          const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
          const defaultData = { 
            id, 
            title: `動画 (ID: ${id})`,
            thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` 
          };
          if (!response.ok) return defaultData;
          const data = await response.json();
          if (data.error) return defaultData;
          return { 
            id, 
            title: data.title || `無題の動画 (ID: ${id})`,
            thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
          };
        });
        return await Promise.all(videoDataPromises);
      } catch (error) {
        console.error("動画情報の取得中にエラーが発生しました:", error);
        return ids.map((id) => ({ 
            id, 
            title: `動画 (ID: ${id})`,
            thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
        }));
      }
  }, []);
  
  useEffect(() => {
    const loadInitialVideos = async () => {
        setIsLoading(true);
        const fetchedVideos = await fetchVideoDetails(initialVideoIds);
        setVideos(fetchedVideos);
        setIsLoading(false);
    }
    loadInitialVideos();
  }, [fetchVideoDetails, initialVideoIds]);

  const handleSelectNewVideo = (id: string) => {
    if (videoId !== id) {
      setVideoId(id);
    }
  };

  const handleSelectVideoFromModal = (id: string) => {
    handleSelectNewVideo(id);
    setIsModalOpen(false); // Also close the modal
  };

  const handleToggleFavorite = (id: string) => {
    setFavoriteIds(prev => 
        prev.includes(id) ? prev.filter(favId => favId !== id) : [...prev, id]
    );
  };

  const handleAddVideo = useCallback(async (url: string) => {
    const extractVideoId = (url: string): string | null => {
      const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      const match = url.match(regex);
      return match ? match[1] : null;
    };
    
    const newVideoId = extractVideoId(url);
    if (!newVideoId) {
        throw new Error('無効なYouTube URLです。');
    }

    if (videos.some(v => v.id === newVideoId)) {
        handleSelectVideoFromModal(newVideoId);
        return;
    }

    try {
        const fetchedVideo = await fetchVideoDetails([newVideoId]);
        if (fetchedVideo.length > 0) {
            setVideos(prevVideos => [fetchedVideo[0], ...prevVideos]);
            handleSelectVideoFromModal(newVideoId);
        } else {
            throw new Error('動画情報の取得に失敗しました。');
        }
    } catch (error) {
        console.error("動画情報の取得中にエラーが発生しました:", error);
        throw new Error('動画の追加に失敗しました。URLを確認してください。');
    }
  }, [videos, fetchVideoDetails]);
  
  const handleResetFavorites = () => {
      setFavoriteIds([]);
  };

  const handleResetUserVideos = () => {
    setVideos(currentVideos => {
      const initialVideoIdSet = new Set(initialVideoIds);
      return currentVideos.filter(video => initialVideoIdSet.has(video.id));
    });
    if (!initialVideoIds.includes(videoId)) {
        if (initialVideoIds.length > 0) {
            const randomIndex = Math.floor(Math.random() * initialVideoIds.length);
            setVideoId(initialVideoIds[randomIndex]);
        } else {
            setVideoId('');
        }
    }
  };

  const handleFeelingLucky = () => {
    if (videos.length <= 1) return;

    let newVideoId: string;
    // This loop is guaranteed to terminate if videos.length > 1
    do {
        const randomIndex = Math.floor(Math.random() * videos.length);
        newVideoId = videos[randomIndex].id;
    } while (newVideoId === videoId);

    handleSelectNewVideo(newVideoId);
  };

  useEffect(() => {
    const keyMap: Record<string, ButtonColor> = { 'w': 'red', 'W': 'red', 'a': 'green', 'A': 'green', 'd': 'yellow', 'D': 'yellow' };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.target as HTMLElement).tagName === 'INPUT') return;
      const color = keyMap[event.key];
      if (color) {
        event.preventDefault();
        gameControlsRef.current?.pressButton(color);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const color = keyMap[event.key];
      if (color) {
        event.preventDefault();
        gameControlsRef.current?.releaseButton(color);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&mute=${isMuted ? 1 : 0}&rel=0&playsinline=1`;

  const isFavoritesResettable = favoriteIds.length > 0;
  const isUserVideosResettable = videos.length > initialVideoIds.length;

  return (
    <>
    <main className="bg-pink-50 dark:bg-rose-900 min-h-screen flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8 font-sans transition-colors duration-300">
      <div className="w-full max-w-5xl mx-auto">
        <header className="relative text-center mb-6">
            <div className="absolute top-0 right-0 z-30">
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full text-rose-500 dark:text-rose-400 hover:bg-pink-200 dark:hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-rose-900"
                    aria-label="Toggle theme"
                >
                    {theme === 'light' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    )}
                </button>
            </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-rose-900 dark:text-rose-100 drop-shadow-lg">
            アイカツ！気分
          </h1>
        </header>

        <div className="w-full max-w-4xl mx-auto mb-6">
            {isLoading ? (
                <p className="text-center text-rose-500 dark:text-rose-400">動画リストを読み込み中...</p>
            ) : (
                <FavoritesCarousel videos={favoriteVideos} onSelectVideo={handleSelectNewVideo} currentVideoId={videoId} />
            )}
        </div>

        <div className="flex justify-center items-center gap-4 mb-8">
          <button
            onClick={handleFeelingLucky}
            className="flex items-center justify-center w-12 h-12 bg-white dark:bg-rose-800 border border-pink-300 dark:border-rose-700 rounded-lg text-2xl text-rose-900 dark:text-rose-200 hover:bg-pink-100 dark:hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-pink-50 dark:ring-offset-rose-900 focus:ring-indigo-500 transition-all duration-200"
            aria-label="ランダムに動画を選ぶ"
            title="おまかせ選曲"
          >
            <span>☘️</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 w-48 px-4 py-3 bg-indigo-600 border border-transparent rounded-lg text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-pink-50 dark:ring-offset-rose-900 focus:ring-indigo-500 transition-all duration-200 font-semibold"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" />
            </svg>
            <span>動画を選ぶ</span>
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="flex items-center justify-center gap-2 w-40 px-4 py-3 bg-white dark:bg-rose-800 border border-pink-300 dark:border-rose-700 rounded-lg text-rose-900 dark:text-rose-200 hover:bg-pink-100 dark:hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-pink-50 dark:ring-offset-rose-900 focus:ring-indigo-500 transition-all duration-200"
            aria-label={isMuted ? "ミュートを解除する" : "動画をミュートする"}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l-2.25 2.25M19.5 12l2.25-2.25M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774ZM6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              </svg>
            )}
            <span className="font-semibold">{isMuted ? '音声ON' : '音声OFF'}</span>
          </button>
        </div>
        
        <div className="w-full aspect-video rounded-2xl shadow-2xl overflow-hidden bg-black ring-4 ring-offset-4 ring-offset-pink-50 dark:ring-offset-rose-900 ring-indigo-600">
          <iframe
            key={videoId}
            className="w-full h-full"
            src={embedUrl}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        </div>
        
        <GameControls ref={gameControlsRef} soundType="tick" />
        
        <footer className="mt-8 text-center text-rose-500 dark:text-rose-400 text-sm">
          <p>ReactとTailwind CSSで構築</p>
        </footer>
      </div>
    </main>
    <VideoSelectionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        videos={videos}
        onSelectVideo={handleSelectVideoFromModal}
        favoriteIds={favoriteIds}
        onToggleFavorite={handleToggleFavorite}
        onAddVideo={handleAddVideo}
        onResetFavorites={handleResetFavorites}
        onResetUserVideos={handleResetUserVideos}
        isFavoritesResettable={isFavoritesResettable}
        isUserVideosResettable={isUserVideosResettable}
    />
    </>
  );
};

export default App;
