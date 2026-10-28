/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Heart, 
  Volume2, 
  VolumeX, 
  Pause, 
  Play, 
  RotateCcw, 
  Trophy, 
  Zap, 
  Shield, 
  Flame, 
  Sparkles,
  ArrowRight,
  Info,
  ChevronLeft,
  ChevronRight,
  Share2,
  Download,
  Copy,
  Check,
  Smartphone,
  ExternalLink,
  X,
  QrCode
} from 'lucide-react';
import { usePWAInstall } from './usePWAInstall.ts';

// ==========================================
// 👑 GAME BALANCE & EASY-TO-EDIT CONSTANTS
// ==========================================
// Level 5 Boss hit points as explicitly requested
export const GIANT_KING_HITS = 150;

export const CONFIG = {
  // Boss hit points for each level
  GIANT_KING_HITS,
  BOSS_HITS: {
    1: 50,  // Level 1: Stone-skin Giant
    2: 75,  // Level 2: Sky Dragon
    3: 100, // Level 3: Kaiju Lizard Monster
    4: 125, // Level 4: Ancient T-Rex
    5: GIANT_KING_HITS, // Level 5: The Giant King
  } as Record<number, number>,

  // Duration (seconds) of the falling barrier wave before the boss appears
  BARRIER_PHASE_DURATION: 45,

  // Player configurations
  PLAYER_MAX_LIVES: 5,
  PLAYER_START_LIVES: 3,
  PLAYER_SPEED: 460,           // Virtual pixels per second
  BULLET_SPEED: 820,           // Pixels per second upwards
  BASE_FIRE_INTERVAL: 0.22,    // Seconds per shot
  RAPID_FIRE_INTERVAL: 0.11,   // Seconds per shot when rapid fire is active
  POWERUP_DURATION: 12,        // Seconds for rapid-fire & triple-shot
  POWERUP_DROP_CHANCE: 0.32,   // 32% chance when a barrier is shattered

  // Virtual canvas coordinate space (scaled dynamically to fit any display)
  VIRTUAL_WIDTH: 800,
  VIRTUAL_HEIGHT: 1000,
};

// ==========================================
// 🎨 CHARACTERS DATA (HEROES & PRINCESSES)
// ==========================================
export interface HeroOption {
  id: string;
  name: string;
  title: string;
  emoji: string;
  bulletEmoji: string;
  perk: string;
  themeColor: string;
  bulletColor: string;
}

export interface PrincessOption {
  id: string;
  name: string;
  title: string;
  emoji: string;
  quote: string;
  themeColor: string;
}

export const HEROES: HeroOption[] = [
  {
    id: 'wizard',
    name: 'Merlin',
    title: 'Arcane Mage',
    emoji: '🧙‍♂️',
    bulletEmoji: '✨',
    perk: 'Fast Mana Bolts & Magic Trail',
    themeColor: '#8b5cf6',
    bulletColor: '#c084fc',
  },
  {
    id: 'knight',
    name: 'Sir Arthur',
    title: 'Royal Knight',
    emoji: '⚔️',
    bulletEmoji: '🗡️',
    perk: 'Sturdy Blade Flurry',
    themeColor: '#3b82f6',
    bulletColor: '#60a5fa',
  },
  {
    id: 'archer',
    name: 'Robin',
    title: 'Swift Ranger',
    emoji: '🏹',
    bulletEmoji: '⚡',
    perk: 'High Agility & Piercing Volley',
    themeColor: '#10b981',
    bulletColor: '#34d399',
  },
  {
    id: 'ninja',
    name: 'Shadow',
    title: 'Silent Shinobi',
    emoji: '🥷',
    bulletEmoji: '⭐',
    perk: 'Razor Shurikens & Smoke Drift',
    themeColor: '#f43f5e',
    bulletColor: '#fb7185',
  },
];

export const PRINCESSES: PrincessOption[] = [
  {
    id: 'aurelia',
    name: 'Princess Aurelia',
    title: 'The Golden Heir',
    emoji: '👸',
    quote: 'My hero! I knew you would come!',
    themeColor: '#f59e0b',
  },
  {
    id: 'flora',
    name: 'Princess Flora',
    title: 'Fairy of the Woodlands',
    emoji: '🧚‍♀️',
    quote: 'The forest and I are forever grateful!',
    themeColor: '#10b981',
  },
  {
    id: 'valerie',
    name: 'Princess Valerie',
    title: 'Warrior Maiden',
    emoji: '👑',
    quote: 'Together we defeated the darkness!',
    themeColor: '#ec4899',
  },
  {
    id: 'lunaria',
    name: 'Princess Lunaria',
    title: 'Star Starlight',
    emoji: '🧝‍♀️',
    quote: 'The stars guided your brave path!',
    themeColor: '#6366f1',
  },
];

// ==========================================
// 🔊 PROCEDURAL WEB AUDIO SYNTHESIZER
// ==========================================
class SoundEngine {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  constructor() {
    // AudioContext is initialized on user gesture
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playShoot(triple = false) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = triple ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(triple ? 880 : 650, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Audio fallback silent
    }
  }

  public playHit() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  public playExplosion(isBig = false) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // White noise buffer
      const bufferSize = this.ctx.sampleRate * (isBig ? 0.6 : 0.25);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isBig ? 450 : 700, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + (isBig ? 0.6 : 0.25));

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(isBig ? 0.35 : 0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isBig ? 0.6 : 0.25));

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    } catch {}
  }

  public playPowerup() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + idx * 0.07;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch {}
  }

  public playHurt() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.25);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  public playBossWarning() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.35;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.linearRampToValueAtTime(680, t + 0.2);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      }
    } catch {}
  }

  public playBossAttack() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }

  public playLevelWin() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const fanfare = [440, 554.37, 659.25, 880];
      fanfare.forEach((f, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.12;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    } catch {}
  }

  public playEndingMelody() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Romantic sweet celebratory arpeggio
      const melody = [
        { f: 523.25, d: 0.25 }, // C5
        { f: 659.25, d: 0.25 }, // E5
        { f: 783.99, d: 0.25 }, // G5
        { f: 987.77, d: 0.35 }, // B5
        { f: 1046.5, d: 0.6  }, // C6
        { f: 783.99, d: 0.3  }, // G5
        { f: 1046.5, d: 0.8  }, // C6 long
      ];
      let cur = now;
      melody.forEach(n => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, cur);
        gain.gain.setValueAtTime(0.18, cur);
        gain.gain.exponentialRampToValueAtTime(0.001, cur + n.d);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(cur);
        osc.stop(cur + n.d);
        cur += n.d * 0.85;
      });
    } catch {}
  }

  public playDevilLaugh() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Demonic laugh pitches: 5 descending sinister chuckles with low-pass resonance
      const chuckles = [135, 118, 102, 88, 74];
      chuckles.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const t = now + idx * 0.15;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + 0.13);

        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(freq * 0.5, t);
        subOsc.frequency.exponentialRampToValueAtTime(freq * 0.35, t + 0.13);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(420, t);
        filter.Q.setValueAtTime(4.5, t);

        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

        osc.connect(filter);
        subOsc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        subOsc.start(t);
        osc.stop(t + 0.14);
        subOsc.stop(t + 0.14);
      });

      speakVoice("Bwahahaha! Mwahahaha!", 0.22, 0.75);
    } catch {}
  }

  public playBossOhNoSound() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Heavy sub-bass groan + distorted downward pitch slide for "OH NO!"
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.85);

      sub.type = 'sine';
      sub.frequency.setValueAtTime(60, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + 0.95);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(70, now + 0.9);
      filter.Q.setValueAtTime(5, now);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

      osc.connect(filter);
      sub.connect(gain);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      sub.start(now);
      osc.stop(now + 0.95);
      sub.stop(now + 0.95);

      speakVoice("OH NO! NOOOOO!", 0.15, 0.65);
    } catch {}
  }
}

// Deep bass speech helper
function speakVoice(text: string, pitch = 0.22, rate = 0.7) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (sounds && sounds.isMuted) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = Math.max(0.1, Math.min(2, pitch));
    utterance.rate = Math.max(0.5, Math.min(2, rate));
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const deepVoice = voices.find(v => 
      v.lang.startsWith('en') && 
      (v.name.toLowerCase().includes('male') || 
       v.name.toLowerCase().includes('david') || 
       v.name.toLowerCase().includes('guy') || 
       v.name.toLowerCase().includes('daniel') ||
       v.name.toLowerCase().includes('natural'))
    );
    if (deepVoice) {
      utterance.voice = deepVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch {}
}

const sounds = new SoundEngine();

// ==========================================
// 🎮 GAME ENTITY TYPES
// ==========================================
export type GameState = 
  | 'start' 
  | 'intro_banner' 
  | 'playing' 
  | 'boss_warning' 
  | 'boss_fight' 
  | 'level_clear' 
  | 'game_over' 
  | 'ending_cutscene';

export type PowerUpType = 'rapid_fire' | 'shield' | 'extra_life' | 'triple_shot';

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  lives: number;
  shield: boolean;
  rapidFireTimer: number;
  tripleShotTimer: number;
  invincibleTimer: number;
  lastShootTime: number;
  targetX: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isPlayer: boolean;
  damage: number;
  emoji?: string;
}

export interface Barrier {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: 'crate' | 'rock' | 'stone' | 'steel' | 'gem';
  emoji: string;
  points: number;
  wobbleOffset: number;
}

export interface Boss {
  level: number;
  name: string;
  emoji: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  vx: number;
  direction: number;
  attackTimer: number;
  specialTimer: number;
  phase: number;
  isChargingBeam: boolean;
  beamChargeProgress: number;
  beamActiveTime: number;
  beamX: number;
  speechText?: string;
  speechTimer?: number;
  speechColor?: string;
  hasTriggeredHalfHpVoice?: boolean;
  hasTriggeredLowHpVoice?: boolean;
  lastLaughTime?: number;
}

export interface PowerUpItem {
  id: number;
  x: number;
  y: number;
  type: PowerUpType;
  emoji: string;
  speedY: number;
  bobTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  isEmoji?: boolean;
  emojiChar?: string;
  spin?: number;
  rotation?: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  life: number;
}

// Background layer details for parallax
interface ParallaxLayer {
  speed: number;
  yOffset: number;
  elements: Array<{ x: number; y: number; char: string; size: number; opacity: number }>;
}

// Cutscene actor
interface CutsceneState {
  princessX: number;
  princessY: number;
  heroX: number;
  heroY: number;
  cageY: number;
  cageBroken: boolean;
  stage: 'cage' | 'unlocking' | 'running' | 'embraced' | 'walking_home' | 'house_arrival';
  timer: number;
  houseX: number;
}

// ==========================================
// 🚀 MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  // Game control & meta state
  const [gameState, setGameState] = useState<GameState>('start');
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('rescue_princess_high_score');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [autoFire, setAutoFire] = useState<boolean>(true);

  // Character selection
  const [selectedHeroIndex, setSelectedHeroIndex] = useState<number>(0);
  const [selectedPrincessIndex, setSelectedPrincessIndex] = useState<number>(0);

  // Level intro banner text
  const [introTitle, setIntroTitle] = useState<string>('');
  const [introSubtitle, setIntroSubtitle] = useState<string>('');

  // HUD stats for smooth React display
  const [hudLives, setHudLives] = useState<number>(CONFIG.PLAYER_START_LIVES);
  const [hudBossHp, setHudBossHp] = useState<{ current: number; max: number; name: string; emoji: string } | null>(null);
  const [hudProgress, setHudProgress] = useState<number>(0); // 0 to 1 wave progress
  const [hudPowerups, setHudPowerups] = useState<{ rapidFire: number; tripleShot: number; shield: boolean }>({
    rapidFire: 0,
    tripleShot: 0,
    shield: false,
  });

  // Ending stats
  const [gameStats, setGameStats] = useState({
    totalScore: 0,
    bossesDefeated: 5,
    accuracy: 94,
    timeSeconds: 0,
  });

  // PWA Install & Share state
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [activeShareTab, setActiveShareTab] = useState<'share' | 'install'>('share');

  const shareUrl = typeof window !== 'undefined' 
    ? window.location.href 
    : 'https://ais-pre-n5s3o2bn5jxegvn5o4b5kx-187793029932.asia-northeast1.run.app';

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }).catch(() => {});
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Rescue the Princess',
          text: 'Play Rescue the Princess! Dodge falling hazards, defeat 5 epic bosses, and save the princess!',
          url: shareUrl,
        });
        return;
      } catch {}
    }
    handleCopyLink();
  };

  const [installSuccessToast, setInstallSuccessToast] = useState<boolean>(false);

  const handleUniversalInstall = async () => {
    const res = await install();
    if (res === 'installed') {
      setInstallSuccessToast(true);
      setTimeout(() => setInstallSuccessToast(false), 3500);
      sounds.playLevelWin();
    } else if (res === 'ios' || res === 'instructions') {
      setActiveShareTab('install');
      setShowShareModal(true);
    }
  };

  // Canvas and game loop refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mutable Game Loop State
  const gameRef = useRef<{
    player: Player;
    bullets: Bullet[];
    barriers: Barrier[];
    boss: Boss | null;
    powerups: PowerUpItem[];
    particles: Particle[];
    floatingTexts: FloatingText[];
    parallaxStars: ParallaxLayer[];
    cutscene: CutsceneState;
    waveTimer: number;
    barrierSpawnTimer: number;
    screenShake: number;
    hitStopFrames: number;
    keys: { [key: string]: boolean };
    isFiring: boolean;
    touchStartX: number | null;
    totalPlayTime: number;
    bulletsFired: number;
    bulletsHit: number;
    nextBarrierId: number;
    nextPowerupId: number;
    nextTextId: number;
  }>({
    player: {
      x: CONFIG.VIRTUAL_WIDTH / 2,
      y: CONFIG.VIRTUAL_HEIGHT - 110,
      width: 58,
      height: 58,
      lives: CONFIG.PLAYER_START_LIVES,
      shield: false,
      rapidFireTimer: 0,
      tripleShotTimer: 0,
      invincibleTimer: 0,
      lastShootTime: 0,
      targetX: CONFIG.VIRTUAL_WIDTH / 2,
    },
    bullets: [],
    barriers: [],
    boss: null,
    powerups: [],
    particles: [],
    floatingTexts: [],
    parallaxStars: [],
    cutscene: {
      princessX: CONFIG.VIRTUAL_WIDTH / 2,
      princessY: 260,
      heroX: CONFIG.VIRTUAL_WIDTH / 2,
      heroY: CONFIG.VIRTUAL_HEIGHT - 120,
      cageY: 260,
      cageBroken: false,
      stage: 'cage',
      timer: 0,
      houseX: CONFIG.VIRTUAL_WIDTH - 180,
    },
    waveTimer: 0,
    barrierSpawnTimer: 0,
    screenShake: 0,
    hitStopFrames: 0,
    keys: {},
    isFiring: false,
    touchStartX: null,
    totalPlayTime: 0,
    bulletsFired: 0,
    bulletsHit: 0,
    nextBarrierId: 1,
    nextPowerupId: 1,
    nextTextId: 1,
  });

  const hero = HEROES[selectedHeroIndex];
  const princess = PRINCESSES[selectedPrincessIndex];

  // Sync mute state
  const toggleMute = () => {
    sounds.isMuted = !isMuted;
    setIsMuted(!isMuted);
  };

  // High score saver
  const checkAndSaveHighScore = useCallback((newScore: number) => {
    setHighScore(prev => {
      if (newScore > prev) {
        try {
          localStorage.setItem('rescue_princess_high_score', String(newScore));
        } catch {
          // Ignore storage quota
        }
        return newScore;
      }
      return prev;
    });
  }, []);

  // ==========================================
  // 🌟 PARALLAX BACKGROUND GENERATOR
  // ==========================================
  const generateParallaxLayers = useCallback((lvl: number): ParallaxLayer[] => {
    const layers: ParallaxLayer[] = [];

    if (lvl === 1) {
      // Meadow
      layers.push({
        speed: 0.15,
        yOffset: 0,
        elements: Array.from({ length: 14 }).map(() => ({
          x: Math.random() * CONFIG.VIRTUAL_WIDTH,
          y: Math.random() * CONFIG.VIRTUAL_HEIGHT * 0.45,
          char: Math.random() > 0.5 ? '☁️' : '☀️',
          size: 28 + Math.random() * 24,
          opacity: 0.65,
        })),
      });
      layers.push({
        speed: 0.5,
        yOffset: 0,
        elements: Array.from({ length: 24 }).map(() => ({
          x: Math.random() * CONFIG.VIRTUAL_WIDTH,
          y: Math.random() * CONFIG.VIRTUAL_HEIGHT,
          char: ['🌸', '🌼', '🍀', '🍃'][Math.floor(Math.random() * 4)],
          size: 16 + Math.random() * 12,
          opacity: 0.45,
        })),
      });
    } else if (lvl === 2) {
      // Mountain Peaks
      layers.push({
        speed: 0.18,
        yOffset: 0,
        elements: Array.from({ length: 18 }).map(() => ({
          x: Math.random() * CONFIG.VIRTUAL_WIDTH,
          y: Math.random() * CONFIG.VIRTUAL_HEIGHT * 0.6,
          char: Math.random() > 0.7 ? '🦅' : '🏔️',
          size: 32 + Math.random() * 20,
          opacity: 0.5,
        })),
      });
      layers.push({
        speed: 0.65,
        yOffset: 0,
        elements: Array.from({ length: 30 }).map(() => ({
          x: Math.random() * CONFIG.VIRTUAL_WIDTH,
          y: Math.random() * CONFIG.VIRTUAL_HEIGHT,
          char: '❄️',
          size: 14 + Math.random() * 14,
          opacity: 0.6,
        })),
      });
    } else if (lvl === 3) {
      // Volcano
      layers.push({
        speed: 0.22,
        yOffset: 0,
        elements: Array.from({ length: 16 }).map(() => ({
          x: Math.random() * CONFIG.VIRTUAL_WIDTH,
          y: Math.random() * CONFIG.VIRTUAL_HEIGHT * 0.5,
          char: '🌋',
          size: 40 + Math.random() * 25,
          opacity: 0.4,
        })),
      });
      layers.push({
        speed: 0.8,
        yOffset: 0,
        elements: Array.from({ length: 35 }).map(() => ({
          x: Math.random() * CONFIG.VIRTUAL_WIDTH,
          y: Math.random() * CONFIG.VIRTUAL_HEIGHT,
          char: Math.random() > 0.4 ? '🔥' : '✨',
          size: 12 + Math.random() * 16,
          opacity: 0.75,
        })),
      });
    } else if (lvl === 4) {
      // Primeval Swamp / Jungle
      layers.push({
        speed: 0.2,
        yOffset: 0,
        elements: Array.from({ length: 16 }).map(() => ({
          x: Math.random() * CONFIG.VIRTUAL_WIDTH,
          y: Math.random() * CONFIG.VIRTUAL_HEIGHT * 0.6,
          char: '🌴',
          size: 36 + Math.random() * 24,
          opacity: 0.45,
        })),
      });
      layers.push({
        speed: 0.55,
        yOffset: 0,
        elements: Array.from({ length: 28 }).map(() => ({
          x: Math.random() * CONFIG.VIRTUAL_WIDTH,
          y: Math.random() * CONFIG.VIRTUAL_HEIGHT,
          char: Math.random() > 0.5 ? '🍄' : '🌿',
          size: 16 + Math.random() * 14,
          opacity: 0.6,
        })),
      });
    } else {
      // Level 5: Dark Royal Citadel
      layers.push({
        speed: 0.15,
        yOffset: 0,
        elements: Array.from({ length: 14 }).map(() => ({
          x: Math.random() * CONFIG.VIRTUAL_WIDTH,
          y: Math.random() * CONFIG.VIRTUAL_HEIGHT * 0.5,
          char: '🏰',
          size: 42 + Math.random() * 28,
          opacity: 0.4,
        })),
      });
      layers.push({
        speed: 0.7,
        yOffset: 0,
        elements: Array.from({ length: 32 }).map(() => ({
          x: Math.random() * CONFIG.VIRTUAL_WIDTH,
          y: Math.random() * CONFIG.VIRTUAL_HEIGHT,
          char: Math.random() > 0.6 ? '⚡' : '🔮',
          size: 14 + Math.random() * 16,
          opacity: 0.7,
        })),
      });
    }

    return layers;
  }, []);

  // ==========================================
  // 💥 PARTICLE & FLOATING TEXT HELPERS
  // ==========================================
  const addParticles = (
    x: number, 
    y: number, 
    count: number, 
    colors: string[], 
    speed = 220, 
    emoji?: string
  ) => {
    const list = gameRef.current.particles;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = (Math.random() * 0.8 + 0.2) * speed;
      const life = 0.4 + Math.random() * 0.5;
      list.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 7,
        alpha: 1,
        life: 0,
        maxLife: life,
        isEmoji: !!emoji,
        emojiChar: emoji,
        spin: (Math.random() - 0.5) * 8,
        rotation: Math.random() * Math.PI * 2,
      });
    }
  };

  const addFloatingText = (x: number, y: number, text: string, color = '#facc15') => {
    gameRef.current.floatingTexts.push({
      id: gameRef.current.nextTextId++,
      x,
      y,
      text,
      color,
      alpha: 1,
      life: 0,
    });
  };

  // ==========================================
  // 👹 CREATE BOSS FOR CURRENT LEVEL
  // ==========================================
  const createBossForLevel = useCallback((lvl: number): Boss => {
    let name = 'Stone Giant';
    let emoji = '👹';
    let title = 'Level 1: The Mountain Ogre';
    let hits = CONFIG.BOSS_HITS[1];

    if (lvl === 2) {
      name = 'Sky Dragon';
      emoji = '🐉';
      title = 'Level 2: The Fire Drake';
      hits = CONFIG.BOSS_HITS[2];
    } else if (lvl === 3) {
      name = 'Godzilla Lizard';
      emoji = '🦖';
      title = 'Level 3: The Primordial Kaiju';
      hits = CONFIG.BOSS_HITS[3];
    } else if (lvl === 4) {
      name = 'Apex T-Rex';
      emoji = '🦕';
      title = 'Level 4: The Thunder Behemoth';
      hits = CONFIG.BOSS_HITS[4];
    } else if (lvl === 5) {
      name = 'The Giant King';
      emoji = '👑';
      title = 'Level 5: The Dread King';
      hits = CONFIG.BOSS_HITS[5] || CONFIG.GIANT_KING_HITS;
    }

    return {
      level: lvl,
      name,
      emoji,
      title,
      x: CONFIG.VIRTUAL_WIDTH / 2,
      y: 160,
      width: 130,
      height: 130,
      hp: hits,
      maxHp: hits,
      vx: 180 + lvl * 25,
      direction: 1,
      attackTimer: 1.0,
      specialTimer: 4.0,
      phase: 1,
      isChargingBeam: false,
      beamChargeProgress: 0,
      beamActiveTime: 0,
      beamX: CONFIG.VIRTUAL_WIDTH / 2,
      speechText: 'MWAHAHAHA! 😈',
      speechTimer: 2.8,
      speechColor: '#fecdd3',
      hasTriggeredHalfHpVoice: false,
      hasTriggeredLowHpVoice: false,
      lastLaughTime: 0,
    };
  }, []);

  // ==========================================
  // 🎮 START LEVEL TRANSITIONS
  // ==========================================
  const startLevel = useCallback((lvl: number) => {
    setCurrentLevel(lvl);
    gameRef.current.parallaxStars = generateParallaxLayers(lvl);
    gameRef.current.waveTimer = 0;
    gameRef.current.barrierSpawnTimer = 0;
    gameRef.current.barriers = [];
    gameRef.current.bullets = [];
    gameRef.current.boss = null;
    gameRef.current.player.shield = false;
    gameRef.current.player.rapidFireTimer = 0;
    gameRef.current.player.tripleShotTimer = 0;
    gameRef.current.player.invincibleTimer = 1.5; // brief spawn grace
    gameRef.current.player.x = CONFIG.VIRTUAL_WIDTH / 2;
    gameRef.current.player.targetX = CONFIG.VIRTUAL_WIDTH / 2;

    const titles: Record<number, { title: string; sub: string }> = {
      1: { title: 'LEVEL 1: GIANT AWAITS!', sub: 'Dodge the rocks and defeat the Mountain Ogre (50 Hits)!' },
      2: { title: 'LEVEL 2: SKY DRAGON FLIES!', sub: 'Watch out for raining fireballs and swoops (75 Hits)!' },
      3: { title: 'LEVEL 3: KAIJU LIZARD AWAKENS!', sub: 'Evade radioactive energy beams and plasma spikes (100 Hits)!' },
      4: { title: 'LEVEL 4: T-REX STOMPS!', sub: 'Jump over seismic shockwaves and tremors (125 Hits)!' },
      5: { title: 'FINAL LEVEL: GIANT KING AWAITS!', sub: `Defeat the King (${CONFIG.GIANT_KING_HITS} Hits) to Rescue Princess ${princess.name}!` },
    };

    const info = titles[lvl] || titles[1];
    setIntroTitle(info.title);
    setIntroSubtitle(info.sub);
    setGameState('intro_banner');

    // Auto-advance from intro to playing after 2.4s
    const timer = setTimeout(() => {
      setGameState('playing');
    }, 2400);

    return () => clearTimeout(timer);
  }, [generateParallaxLayers, princess.name]);

  // Handle Game Start
  const handleStartGame = () => {
    sounds.playShoot();
    setScore(0);
    gameRef.current.player.lives = CONFIG.PLAYER_START_LIVES;
    gameRef.current.totalPlayTime = 0;
    gameRef.current.bulletsFired = 0;
    gameRef.current.bulletsHit = 0;
    setHudLives(CONFIG.PLAYER_START_LIVES);
    startLevel(1);
  };

  // Retry Current Level
  const handleRetryLevel = () => {
    gameRef.current.player.lives = CONFIG.PLAYER_START_LIVES;
    setHudLives(CONFIG.PLAYER_START_LIVES);
    startLevel(currentLevel);
  };

  // ==========================================
  // 🕹️ INPUT LISTENERS (DESKTOP & TOUCH)
  // ==========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
        e.preventDefault();
      }
      gameRef.current.keys[e.code] = true;

      // Quick start with Space or Enter
      if ((e.code === 'Space' || e.code === 'Enter') && gameState === 'start') {
        handleStartGame();
      }

      // Pause toggle
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'playing' || gameState === 'boss_fight') {
          setIsPaused(prev => !prev);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameRef.current.keys[e.code] = false;
    };

    const handleBlur = () => {
      gameRef.current.keys = {};
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameState]);

  // Touch & Mouse Drag on Canvas
  const handlePointerDown = (e: React.PointerEvent) => {
    if (gameState === 'start') {
      handleStartGame();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CONFIG.VIRTUAL_WIDTH / rect.width;
    const clientX = e.clientX - rect.left;
    const virtualX = clientX * scaleX;
    gameRef.current.player.targetX = Math.max(30, Math.min(CONFIG.VIRTUAL_WIDTH - 30, virtualX));
    gameRef.current.isFiring = true;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (e.buttons > 0 || e.pointerType === 'touch') {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CONFIG.VIRTUAL_WIDTH / rect.width;
      const clientX = e.clientX - rect.left;
      const virtualX = clientX * scaleX;
      gameRef.current.player.targetX = Math.max(30, Math.min(CONFIG.VIRTUAL_WIDTH - 30, virtualX));
    }
  };

  const handlePointerUp = () => {
    gameRef.current.isFiring = false;
  };

  // ==========================================
  // 🔄 MAIN SIMULATION & RENDER ENGINE (60 FPS)
  // ==========================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(loop);

      const rawDt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      const dt = Math.min(rawDt, 0.05); // clamped delta time

      // Don't advance simulation if paused or on start screen
      if (isPaused) {
        return;
      }

      const g = gameRef.current;

      // Hitstop logic
      if (g.hitStopFrames > 0) {
        g.hitStopFrames--;
        return;
      }

      // Track total play time
      if (gameState === 'playing' || gameState === 'boss_fight' || gameState === 'boss_warning') {
        g.totalPlayTime += dt;
      }

      // Screen shake decay
      if (g.screenShake > 0) {
        g.screenShake = Math.max(0, g.screenShake - dt * 25);
      }

      // ==========================================
      // 1. UPDATE PLAYER
      // ==========================================
      const p = g.player;
      let moveDir = 0;
      if (g.keys['ArrowLeft'] || g.keys['KeyA']) moveDir -= 1;
      if (g.keys['ArrowRight'] || g.keys['KeyD']) moveDir += 1;

      if (moveDir !== 0) {
        p.x += moveDir * CONFIG.PLAYER_SPEED * dt;
        p.targetX = p.x;
      } else {
        // Smooth touch interpolation
        const dx = p.targetX - p.x;
        if (Math.abs(dx) > 2) {
          p.x += dx * Math.min(1, dt * 14);
        }
      }

      // Clamp player within screen bounds
      p.x = Math.max(p.width / 2, Math.min(CONFIG.VIRTUAL_WIDTH - p.width / 2, p.x));

      // Timers decay
      if (p.invincibleTimer > 0) p.invincibleTimer -= dt;
      if (p.rapidFireTimer > 0) p.rapidFireTimer -= dt;
      if (p.tripleShotTimer > 0) p.tripleShotTimer -= dt;

      // Update React HUD state periodically
      setHudLives(p.lives);
      setHudPowerups({
        rapidFire: Math.max(0, p.rapidFireTimer),
        tripleShot: Math.max(0, p.tripleShotTimer),
        shield: p.shield,
      });

      // Shooting trigger
      const wantShoot = autoFire || g.keys['Space'] || g.isFiring;
      const shootInterval = p.rapidFireTimer > 0 ? CONFIG.RAPID_FIRE_INTERVAL : CONFIG.BASE_FIRE_INTERVAL;

      if (wantShoot && (gameState === 'playing' || gameState === 'boss_fight')) {
        if (currentTime / 1000 - p.lastShootTime >= shootInterval) {
          p.lastShootTime = currentTime / 1000;
          g.bulletsFired++;

          const isTriple = p.tripleShotTimer > 0;
          sounds.playShoot(isTriple);

          if (isTriple) {
            // Triple spread
            g.bullets.push({
              x: p.x,
              y: p.y - 25,
              vx: 0,
              vy: -CONFIG.BULLET_SPEED,
              radius: 6,
              color: hero.bulletColor,
              isPlayer: true,
              damage: 1,
              emoji: hero.bulletEmoji,
            });
            g.bullets.push({
              x: p.x - 14,
              y: p.y - 20,
              vx: -180,
              vy: -CONFIG.BULLET_SPEED * 0.95,
              radius: 6,
              color: hero.bulletColor,
              isPlayer: true,
              damage: 1,
              emoji: hero.bulletEmoji,
            });
            g.bullets.push({
              x: p.x + 14,
              y: p.y - 20,
              vx: 180,
              vy: -CONFIG.BULLET_SPEED * 0.95,
              radius: 6,
              color: hero.bulletColor,
              isPlayer: true,
              damage: 1,
              emoji: hero.bulletEmoji,
            });
          } else {
            // Single shot
            g.bullets.push({
              x: p.x,
              y: p.y - 25,
              vx: 0,
              vy: -CONFIG.BULLET_SPEED,
              radius: 6,
              color: hero.bulletColor,
              isPlayer: true,
              damage: 1,
              emoji: hero.bulletEmoji,
            });
          }
        }
      }

      // ==========================================
      // 2. BARRIER PHASE & WAVE PROGRESSION
      // ==========================================
      if (gameState === 'playing') {
        g.waveTimer += dt;
        const progress = Math.min(1, g.waveTimer / CONFIG.BARRIER_PHASE_DURATION);
        setHudProgress(progress);

        // Barrier spawn logic
        const spawnInterval = Math.max(0.45, 1.4 - currentLevel * 0.16 - progress * 0.35);
        g.barrierSpawnTimer += dt;

        if (g.barrierSpawnTimer >= spawnInterval) {
          g.barrierSpawnTimer = 0;

          // Determine barrier types based on level
          const roll = Math.random();
          let type: Barrier['type'] = 'crate';
          let hp = 1;
          let emoji = '📦';
          let pts = 10;
          let w = 55;
          let h = 55;

          if (roll < 0.1) {
            type = 'gem';
            hp = 2;
            emoji = '💎';
            pts = 150;
            w = 52;
            h = 52;
          } else if (roll < 0.35 && currentLevel >= 3) {
            type = 'steel';
            hp = 5;
            emoji = '⚙️';
            pts = 100;
            w = 64;
            h = 64;
          } else if (roll < 0.6 && currentLevel >= 2) {
            type = 'stone';
            hp = 3;
            emoji = '🧱';
            pts = 50;
            w = 58;
            h = 58;
          } else if (roll < 0.8) {
            type = 'rock';
            hp = 2;
            emoji = '🪨';
            pts = 25;
            w = 54;
            h = 54;
          }

          const baseSpeed = 160 + currentLevel * 30 + progress * 70;
          const randomX = 40 + Math.random() * (CONFIG.VIRTUAL_WIDTH - 80);

          g.barriers.push({
            id: g.nextBarrierId++,
            x: randomX,
            y: -60,
            width: w,
            height: h,
            hp,
            maxHp: hp,
            speed: baseSpeed * (0.85 + Math.random() * 0.3),
            type,
            emoji,
            points: pts,
            wobbleOffset: Math.random() * Math.PI * 2,
          });
        }

        // Check if barrier phase complete -> Boss arrives!
        if (g.waveTimer >= CONFIG.BARRIER_PHASE_DURATION) {
          setGameState('boss_warning');
          sounds.playBossWarning();
          g.screenShake = 14;

          setTimeout(() => {
            const newBoss = createBossForLevel(currentLevel);
            g.boss = newBoss;
            setHudBossHp({
              current: newBoss.hp,
              max: newBoss.maxHp,
              name: newBoss.name,
              emoji: newBoss.emoji,
            });
            setGameState('boss_fight');
            sounds.playDevilLaugh();
          }, 2500);
        }
      }

      // ==========================================
      // 3. UPDATE BARRIERS
      // ==========================================
      for (let i = g.barriers.length - 1; i >= 0; i--) {
        const b = g.barriers[i];
        b.y += b.speed * dt;

        // Player collision with barrier
        const dist = Math.hypot(p.x - b.x, p.y - b.y);
        const hitRadius = (p.width + b.width) * 0.42;

        if (dist < hitRadius && p.invincibleTimer <= 0) {
          // Player hit!
          if (p.shield) {
            p.shield = false;
            p.invincibleTimer = 1.0;
            g.screenShake = 12;
            sounds.playHit();
            addFloatingText(p.x, p.y - 40, 'SHIELD BROKE!', '#60a5fa');
            addParticles(p.x, p.y, 25, ['#60a5fa', '#93c5fd', '#ffffff'], 300);
          } else {
            p.lives -= 1;
            p.invincibleTimer = 1.8;
            g.screenShake = 18;
            sounds.playHurt();
            addFloatingText(p.x, p.y - 40, '-1 LIFE!', '#ef4444');
            addParticles(p.x, p.y, 30, ['#ef4444', '#f87171', '#fbbf24'], 350);

            if (p.lives <= 0) {
              setGameState('game_over');
              sounds.playExplosion(true);
              return;
            }
          }

          // Destroy the barrier on collision
          addParticles(b.x, b.y, 20, ['#f59e0b', '#d97706', '#78350f'], 250);
          g.barriers.splice(i, 1);
          continue;
        }

        // Offscreen removal
        if (b.y > CONFIG.VIRTUAL_HEIGHT + 80) {
          g.barriers.splice(i, 1);
        }
      }

      // ==========================================
      // 4. UPDATE BOSS
      // ==========================================
      if (g.boss && gameState === 'boss_fight') {
        const boss = g.boss;
        boss.x += boss.vx * boss.direction * dt;

        // Decay speech timer
        if (boss.speechTimer && boss.speechTimer > 0) {
          boss.speechTimer -= dt;
        }

        // Periodic devil laugh if boss is healthy (> 65% HP)
        boss.lastLaughTime = (boss.lastLaughTime || 0) + dt;
        if (boss.hp / boss.maxHp > 0.65 && boss.lastLaughTime > 11) {
          boss.lastLaughTime = 0;
          boss.speechText = 'MWAHAHAHA! 😈';
          boss.speechTimer = 2.4;
          boss.speechColor = '#fecdd3';
          sounds.playDevilLaugh();
        }

        // Bounce left and right
        if (boss.x > CONFIG.VIRTUAL_WIDTH - boss.width / 2 - 20) {
          boss.x = CONFIG.VIRTUAL_WIDTH - boss.width / 2 - 20;
          boss.direction = -1;
        } else if (boss.x < boss.width / 2 + 20) {
          boss.x = boss.width / 2 + 20;
          boss.direction = 1;
        }

        // Sine wave vertical hovering for Dragon & Giant King
        if (boss.level === 2 || boss.level === 5) {
          boss.y = 170 + Math.sin(currentTime * 0.003) * 35;
        }

        // Boss basic projectile attack
        boss.attackTimer -= dt;
        if (boss.attackTimer <= 0) {
          boss.attackTimer = Math.max(0.65, 1.8 - currentLevel * 0.22);
          sounds.playBossAttack();

          if (boss.level === 1) {
            // Giant drops heavy boulders
            g.bullets.push({
              x: boss.x,
              y: boss.y + 60,
              vx: (Math.random() - 0.5) * 80,
              vy: 240,
              radius: 12,
              color: '#78716c',
              isPlayer: false,
              damage: 1,
              emoji: '🪨',
            });
          } else if (boss.level === 2) {
            // Dragon shoots twin fireballs aimed slightly toward player
            const dx = p.x - boss.x;
            g.bullets.push({
              x: boss.x - 25,
              y: boss.y + 60,
              vx: dx * 0.35 - 50,
              vy: 320,
              radius: 10,
              color: '#f97316',
              isPlayer: false,
              damage: 1,
              emoji: '🔥',
            });
            g.bullets.push({
              x: boss.x + 25,
              y: boss.y + 60,
              vx: dx * 0.35 + 50,
              vy: 320,
              radius: 10,
              color: '#f97316',
              isPlayer: false,
              damage: 1,
              emoji: '🔥',
            });
          } else if (boss.level === 3) {
            // Kaiju Lizard Monster shoots plasma spikes
            for (let s = -1; s <= 1; s++) {
              g.bullets.push({
                x: boss.x + s * 30,
                y: boss.y + 70,
                vx: s * 140,
                vy: 280,
                radius: 9,
                color: '#a855f7',
                isPlayer: false,
                damage: 1,
                emoji: '🟣',
              });
            }
          } else if (boss.level === 4) {
            // T-Rex stomps and releases ground shockwave
            g.screenShake = 10;
            g.bullets.push({
              x: boss.x,
              y: boss.y + 60,
              vx: -220,
              vy: 290,
              radius: 12,
              color: '#eab308',
              isPlayer: false,
              damage: 1,
              emoji: '💥',
            });
            g.bullets.push({
              x: boss.x,
              y: boss.y + 60,
              vx: 220,
              vy: 290,
              radius: 12,
              color: '#eab308',
              isPlayer: false,
              damage: 1,
              emoji: '💥',
            });
          } else if (boss.level === 5) {
            // Giant King uses ALL attacks!
            const pick = Math.floor(Math.random() * 3);
            if (pick === 0) {
              // Fireball spread
              for (let f = -2; f <= 2; f++) {
                g.bullets.push({
                  x: boss.x + f * 20,
                  y: boss.y + 60,
                  vx: f * 110,
                  vy: 300,
                  radius: 10,
                  color: '#ef4444',
                  isPlayer: false,
                  damage: 1,
                  emoji: '🔥',
                });
              }
            } else if (pick === 1) {
              // Dark meteors
              g.bullets.push({
                x: p.x + (Math.random() - 0.5) * 100,
                y: -30,
                vx: 0,
                vy: 360,
                radius: 12,
                color: '#8b5cf6',
                isPlayer: false,
                damage: 1,
                emoji: '☄️',
              });
            } else {
              // Shockwave pulse
              g.screenShake = 12;
              g.bullets.push({
                x: boss.x,
                y: boss.y + 60,
                vx: 0,
                vy: 330,
                radius: 14,
                color: '#facc15',
                isPlayer: false,
                damage: 1,
                emoji: '👑',
              });
            }
          }
        }

        // Boss Special Attack: Kaiju & Giant King Laser Beam
        if (boss.level === 3 || boss.level === 5) {
          boss.specialTimer -= dt;
          if (boss.specialTimer <= 0 && !boss.isChargingBeam) {
            boss.isChargingBeam = true;
            boss.beamChargeProgress = 0;
            boss.beamActiveTime = 0;
            boss.beamX = boss.x;
          }

          if (boss.isChargingBeam) {
            boss.beamChargeProgress += dt * 0.85; // 1.2s telegraph
            boss.beamX += (boss.x - boss.beamX) * dt * 4; // locks on slowly

            if (boss.beamChargeProgress >= 1) {
              // Firing the beam!
              boss.beamActiveTime += dt;
              g.screenShake = 6;

              // Check if player is caught in the vertical beam
              const beamWidth = 70;
              if (
                Math.abs(p.x - boss.beamX) < beamWidth / 2 + p.width / 2 &&
                p.invincibleTimer <= 0
              ) {
                if (p.shield) {
                  p.shield = false;
                  p.invincibleTimer = 1.0;
                  g.screenShake = 14;
                  sounds.playHit();
                  addFloatingText(p.x, p.y - 40, 'SHIELD BROKE!', '#60a5fa');
                  addParticles(p.x, p.y, 25, ['#60a5fa', '#93c5fd', '#ffffff'], 300);
                } else {
                  p.lives -= 1;
                  p.invincibleTimer = 1.8;
                  g.screenShake = 18;
                  sounds.playHurt();
                  addFloatingText(p.x, p.y - 40, '-1 LIFE!', '#ef4444');
                  addParticles(p.x, p.y, 30, ['#ef4444', '#f87171', '#fbbf24'], 350);

                  if (p.lives <= 0) {
                    setGameState('game_over');
                    sounds.playExplosion(true);
                    return;
                  }
                }
              }

              // Beam lasts 1.2 seconds
              if (boss.beamActiveTime >= 1.2) {
                boss.isChargingBeam = false;
                boss.specialTimer = 5.5 + Math.random() * 2;
              }
            }
          }
        }
      }

      // ==========================================
      // 5. UPDATE BULLETS & COLLISION DETECTION
      // ==========================================
      for (let i = g.bullets.length - 1; i >= 0; i--) {
        const b = g.bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Player bullet
        if (b.isPlayer) {
          // Check collision with barriers
          let bulletRemoved = false;
          for (let j = g.barriers.length - 1; j >= 0; j--) {
            const bar = g.barriers[j];
            if (
              b.x > bar.x - bar.width / 2 &&
              b.x < bar.x + bar.width / 2 &&
              b.y > bar.y - bar.height / 2 &&
              b.y < bar.y + bar.height / 2
            ) {
              bar.hp -= b.damage;
              g.bulletsHit++;
              sounds.playHit();
              addParticles(b.x, b.y, 8, ['#ffffff', b.color]);

              if (bar.hp <= 0) {
                // Barrier destroyed!
                sounds.playExplosion(false);
                addParticles(bar.x, bar.y, 25, ['#f59e0b', '#d97706', '#ffffff', '#fbbf24'], 280);
                setScore(s => {
                  const ns = s + bar.points;
                  checkAndSaveHighScore(ns);
                  return ns;
                });
                addFloatingText(bar.x, bar.y, `+${bar.points}`, '#34d399');

                // Roll for power-up drop
                const guaranteed = bar.type === 'gem';
                if (guaranteed || Math.random() < CONFIG.POWERUP_DROP_CHANCE) {
                  const types: PowerUpType[] = ['rapid_fire', 'shield', 'extra_life', 'triple_shot'];
                  const pickedType = types[Math.floor(Math.random() * types.length)];
                  const pEmojis: Record<PowerUpType, string> = {
                    rapid_fire: '⚡',
                    shield: '🛡️',
                    extra_life: '❤️',
                    triple_shot: '🔱',
                  };
                  g.powerups.push({
                    id: g.nextPowerupId++,
                    x: bar.x,
                    y: bar.y,
                    type: pickedType,
                    emoji: pEmojis[pickedType],
                    speedY: 150,
                    bobTimer: Math.random() * Math.PI,
                  });
                }

                g.barriers.splice(j, 1);
              }

              g.bullets.splice(i, 1);
              bulletRemoved = true;
              break;
            }
          }

          if (bulletRemoved) continue;

          // Check collision with boss
          if (g.boss && gameState === 'boss_fight') {
            const boss = g.boss;
            const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
            if (dist < boss.width * 0.45) {
              boss.hp -= b.damage;
              g.bulletsHit++;
              sounds.playHit();
              addParticles(b.x, b.y, 10, ['#ffffff', '#f59e0b', '#ef4444'], 180);

              // Update React boss HP HUD
              setHudBossHp({
                current: Math.max(0, boss.hp),
                max: boss.maxHp,
                name: boss.name,
                emoji: boss.emoji,
              });

              setScore(s => {
                const ns = s + 15;
                checkAndSaveHighScore(ns);
                return ns;
              });

              // Boss losing reaction: 50% HP threshold ("OH NO!")
              if (boss.hp <= boss.maxHp * 0.5 && !boss.hasTriggeredHalfHpVoice && boss.hp > 0) {
                boss.hasTriggeredHalfHpVoice = true;
                boss.speechText = 'OH NO! MY POWER! 😱';
                boss.speechTimer = 2.8;
                boss.speechColor = '#fef08a';
                g.screenShake = 16;
                sounds.playBossOhNoSound();
                addFloatingText(boss.x, boss.y - 70, 'OH NO! 😱', '#f87171');
                addParticles(boss.x, boss.y, 30, ['#ef4444', '#facc15', '#ffffff'], 280);
              }

              // Boss critical losing reaction: 25% HP threshold ("NOOOOO!")
              if (boss.hp <= boss.maxHp * 0.25 && !boss.hasTriggeredLowHpVoice && boss.hp > 0) {
                boss.hasTriggeredLowHpVoice = true;
                boss.speechText = 'NOOOOO! IMPOSSIBLE! 😱';
                boss.speechTimer = 3.0;
                boss.speechColor = '#fecaca';
                g.screenShake = 20;
                sounds.playBossOhNoSound();
                addFloatingText(boss.x, boss.y - 70, 'NOOOOO! 😱', '#ef4444');
                addParticles(boss.x, boss.y, 40, ['#ef4444', '#dc2626', '#fbbf24'], 320);
              }

              // Check if boss defeated!
              if (boss.hp <= 0) {
                boss.speechText = 'OH NOOOOOOO! 💀';
                boss.speechTimer = 2.0;
                sounds.playBossOhNoSound();
                // Dramatic slow-mo hitstop
                g.hitStopFrames = 12;
                g.screenShake = 28;
                sounds.playExplosion(true);
                addParticles(boss.x, boss.y, 80, ['#f59e0b', '#ef4444', '#facc15', '#ffffff'], 450);

                const bossDefeatBonus = 2000 * currentLevel;
                setScore(s => {
                  const ns = s + bossDefeatBonus;
                  checkAndSaveHighScore(ns);
                  return ns;
                });
                addFloatingText(boss.x, boss.y, `BOSS DEFEATED! +${bossDefeatBonus}`, '#fbbf24');

                g.bullets = [];
                g.barriers = [];

                if (currentLevel >= 5) {
                  // ALL 5 LEVELS BEATEN -> RESCUE PRINCESS CUTSCENE!
                  setTimeout(() => {
                    setGameState('ending_cutscene');
                    sounds.playEndingMelody();
                    g.cutscene = {
                      princessX: CONFIG.VIRTUAL_WIDTH / 2,
                      princessY: 300,
                      heroX: CONFIG.VIRTUAL_WIDTH / 2,
                      heroY: CONFIG.VIRTUAL_HEIGHT - 120,
                      cageY: 300,
                      cageBroken: false,
                      stage: 'cage',
                      timer: 0,
                      houseX: CONFIG.VIRTUAL_WIDTH - 180,
                    };

                    const accuracyCalc = g.bulletsFired > 0 
                      ? Math.min(100, Math.round((g.bulletsHit / g.bulletsFired) * 100)) 
                      : 95;

                    setGameStats({
                      totalScore: score + bossDefeatBonus,
                      bossesDefeated: 5,
                      accuracy: accuracyCalc,
                      timeSeconds: Math.round(g.totalPlayTime),
                    });
                  }, 1200);
                } else {
                  // Next level transition modal
                  setTimeout(() => {
                    setGameState('level_clear');
                    sounds.playLevelWin();
                  }, 1200);
                }
              }

              g.bullets.splice(i, 1);
              continue;
            }
          }
        } else {
          // Boss/Enemy bullet collision with player
          const dist = Math.hypot(b.x - p.x, b.y - p.y);
          if (dist < p.width * 0.42 && p.invincibleTimer <= 0) {
            if (p.shield) {
              p.shield = false;
              p.invincibleTimer = 1.0;
              g.screenShake = 12;
              sounds.playHit();
              addFloatingText(p.x, p.y - 40, 'SHIELD BROKE!', '#60a5fa');
              addParticles(p.x, p.y, 25, ['#60a5fa', '#93c5fd', '#ffffff'], 300);
            } else {
              p.lives -= 1;
              p.invincibleTimer = 1.8;
              g.screenShake = 18;
              sounds.playHurt();
              addFloatingText(p.x, p.y - 40, '-1 LIFE!', '#ef4444');
              addParticles(p.x, p.y, 30, ['#ef4444', '#f87171', '#fbbf24'], 350);

              if (p.lives <= 0) {
                setGameState('game_over');
                sounds.playExplosion(true);
                return;
              }
            }

            g.bullets.splice(i, 1);
            continue;
          }
        }

        // Out of screen removal
        if (b.y < -40 || b.y > CONFIG.VIRTUAL_HEIGHT + 40 || b.x < -40 || b.x > CONFIG.VIRTUAL_WIDTH + 40) {
          g.bullets.splice(i, 1);
        }
      }

      // ==========================================
      // 6. UPDATE POWERUPS
      // ==========================================
      for (let i = g.powerups.length - 1; i >= 0; i--) {
        const item = g.powerups[i];
        item.y += item.speedY * dt;
        item.bobTimer += dt * 5;

        // Pickup collision
        const dist = Math.hypot(p.x - item.x, p.y - item.y);
        if (dist < (p.width / 2 + 25)) {
          sounds.playPowerup();
          addParticles(item.x, item.y, 25, ['#facc15', '#38bdf8', '#ffffff', '#ec4899'], 260);

          if (item.type === 'rapid_fire') {
            p.rapidFireTimer = CONFIG.POWERUP_DURATION;
            addFloatingText(p.x, p.y - 50, 'RAPID FIRE! ⚡', '#facc15');
          } else if (item.type === 'shield') {
            p.shield = true;
            addFloatingText(p.x, p.y - 50, 'SHIELD ACTIVATED! 🛡️', '#38bdf8');
          } else if (item.type === 'extra_life') {
            p.lives = Math.min(CONFIG.PLAYER_MAX_LIVES, p.lives + 1);
            addFloatingText(p.x, p.y - 50, '+1 EXTRA LIFE! ❤️', '#ec4899');
          } else if (item.type === 'triple_shot') {
            p.tripleShotTimer = CONFIG.POWERUP_DURATION;
            addFloatingText(p.x, p.y - 50, 'TRIPLE SHOT! 🔱', '#a855f7');
          }

          setScore(s => {
            const ns = s + 100;
            checkAndSaveHighScore(ns);
            return ns;
          });

          g.powerups.splice(i, 1);
          continue;
        }

        // Offscreen removal
        if (item.y > CONFIG.VIRTUAL_HEIGHT + 40) {
          g.powerups.splice(i, 1);
        }
      }

      // ==========================================
      // 7. UPDATE PARTICLES & TEXTS
      // ==========================================
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const pt = g.particles[i];
        pt.life += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.alpha = Math.max(0, 1 - pt.life / pt.maxLife);
        if (pt.spin) pt.rotation = (pt.rotation || 0) + pt.spin * dt;
        if (pt.life >= pt.maxLife) {
          g.particles.splice(i, 1);
        }
      }

      for (let i = g.floatingTexts.length - 1; i >= 0; i--) {
        const ft = g.floatingTexts[i];
        ft.life += dt;
        ft.y -= dt * 45;
        ft.alpha = Math.max(0, 1 - ft.life / 1.1);
        if (ft.life >= 1.1) {
          g.floatingTexts.splice(i, 1);
        }
      }

      // ==========================================
      // 8. UPDATE CUTSCENE (IF ENDING)
      // ==========================================
      if (gameState === 'ending_cutscene') {
        const cs = g.cutscene;
        cs.timer += dt;

        // Stage 1: Cage unlocking
        if (cs.stage === 'cage' && cs.timer > 1.2) {
          cs.stage = 'unlocking';
          addParticles(cs.princessX, cs.cageY, 30, ['#facc15', '#ffffff', '#fbbf24'], 250, '✨');
          sounds.playPowerup();
        }

        // Stage 2: Cage breaks open
        if (cs.stage === 'unlocking' && cs.timer > 2.6) {
          cs.stage = 'running';
          cs.cageBroken = true;
          sounds.playExplosion(false);
          addParticles(cs.princessX, cs.cageY, 40, ['#94a3b8', '#cbd5e1', '#ffffff'], 320);
          addFloatingText(cs.princessX, cs.princessY - 50, 'FREED! 💖', '#ec4899');
        }

        // Stage 3: Princess runs to hero
        if (cs.stage === 'running') {
          // Princess moves towards hero
          const targetY = cs.heroY - 60;
          cs.princessY += dt * 140;

          // Floating hearts during reunion run
          if (Math.random() < 0.15) {
            addParticles(cs.princessX + (Math.random() - 0.5) * 30, cs.princessY, 1, ['#ec4899'], 80, '❤️');
          }

          if (cs.princessY >= targetY) {
            cs.princessY = targetY;
            cs.stage = 'embraced';
            cs.timer = 0; // reset for next phase
            sounds.playLevelWin();
          }
        }

        // Stage 4: Embraced with hearts
        if (cs.stage === 'embraced') {
          if (Math.random() < 0.25) {
            addParticles(
              CONFIG.VIRTUAL_WIDTH / 2 + (Math.random() - 0.5) * 60,
              cs.heroY - 40,
              1,
              ['#ec4899', '#f43f5e', '#fb7185'],
              90,
              '❤️'
            );
          }

          if (cs.timer > 2.5) {
            cs.stage = 'walking_home';
            cs.timer = 0;
          }
        }

        // Stage 5: Walking home to cottage
        if (cs.stage === 'walking_home') {
          // Hero and princess walk towards the cottage on right
          const speed = 75 * dt;
          cs.heroX += speed;
          cs.princessX += speed;

          // Confetti celebration continuously during walk
          if (Math.random() < 0.3) {
            addParticles(
              Math.random() * CONFIG.VIRTUAL_WIDTH,
              -10,
              2,
              ['#facc15', '#38bdf8', '#ec4899', '#10b981', '#a855f7'],
              160,
              Math.random() > 0.5 ? '🎉' : '✨'
            );
          }

          if (cs.heroX >= cs.houseX - 40) {
            cs.stage = 'house_arrival';
          }
        }

        // Stage 6: House arrival final celebration
        if (cs.stage === 'house_arrival') {
          if (Math.random() < 0.35) {
            addParticles(
              Math.random() * CONFIG.VIRTUAL_WIDTH,
              -20,
              3,
              ['#facc15', '#38bdf8', '#ec4899', '#10b981', '#a855f7', '#fbbf24'],
              200,
              Math.random() > 0.4 ? '🎉' : '⭐'
            );
          }
        }
      }

      // ==========================================
      // 9. DRAW CANVAS FRAME
      // ==========================================
      ctx.save();

      // Screen shake translation
      if (g.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * g.screenShake;
        const shakeY = (Math.random() - 0.5) * g.screenShake;
        ctx.translate(shakeX, shakeY);
      }

      // A. DRAW BACKGROUND
      drawBackground(ctx, currentLevel, gameState);

      // B. DRAW PARALLAX LAYERS
      for (const layer of g.parallaxStars) {
        layer.yOffset = (layer.yOffset + layer.speed * dt * 60) % CONFIG.VIRTUAL_HEIGHT;
        for (const el of layer.elements) {
          const drawY = (el.y + layer.yOffset) % CONFIG.VIRTUAL_HEIGHT;
          ctx.save();
          ctx.globalAlpha = el.opacity;
          ctx.font = `${el.size}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(el.char, el.x, drawY);
          ctx.restore();
        }
      }

      // C. DRAW BARRIERS
      for (const b of g.barriers) {
        ctx.save();
        ctx.translate(b.x, b.y);

        // Gentle wobble
        const wobble = Math.sin(currentTime * 0.005 + b.wobbleOffset) * 4;
        ctx.rotate(wobble * 0.05);

        // Barrier shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, b.height / 2 + 6, b.width * 0.4, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main barrier emoji
        ctx.font = `${b.width}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.emoji, 0, 0);

        // Barrier health indicator (if > 1 hp)
        if (b.maxHp > 1) {
          const barW = 38;
          const barH = 5;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(-barW / 2, -b.height / 2 - 8, barW, barH);
          ctx.fillStyle = b.hp === 1 ? '#ef4444' : '#22c55e';
          ctx.fillRect(-barW / 2, -b.height / 2 - 8, (barW * b.hp) / b.maxHp, barH);
        }

        ctx.restore();
      }

      // D. DRAW POWERUPS
      for (const item of g.powerups) {
        ctx.save();
        ctx.translate(item.x, item.y + Math.sin(item.bobTimer) * 5);

        // Power-up glowing aura
        const gradient = ctx.createRadialGradient(0, 0, 8, 0, 0, 26);
        gradient.addColorStop(0, 'rgba(250, 204, 21, 0.6)');
        gradient.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();

        // Emoji
        ctx.font = '36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, 0, 0);

        ctx.restore();
      }

      // E. DRAW BULLETS
      for (const b of g.bullets) {
        ctx.save();
        if (b.emoji) {
          ctx.font = `${b.radius * 3.2}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(b.emoji, b.x, b.y);
        } else {
          ctx.fillStyle = b.color;
          ctx.shadowColor = b.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // F. DRAW BOSS (IF IN BOSS FIGHT)
      if (g.boss && (gameState === 'boss_fight' || gameState === 'boss_warning')) {
        const boss = g.boss;
        ctx.save();
        ctx.translate(boss.x, boss.y);

        // Boss Energy Beam Telegraph & Ray
        if (boss.isChargingBeam) {
          ctx.save();
          // Warning laser line
          if (boss.beamChargeProgress < 1) {
            ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + Math.sin(currentTime * 0.02) * 0.4})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(0, 50);
            ctx.lineTo(boss.beamX - boss.x, CONFIG.VIRTUAL_HEIGHT);
            ctx.stroke();
          } else {
            // Full Blast Beam!
            const beamW = 75 + Math.sin(currentTime * 0.04) * 12;
            const bGradient = ctx.createLinearGradient(-beamW / 2, 0, beamW / 2, 0);
            bGradient.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
            bGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
            bGradient.addColorStop(1, 'rgba(56, 189, 248, 0.1)');

            ctx.fillStyle = bGradient;
            ctx.fillRect(boss.beamX - boss.x - beamW / 2, 50, beamW, CONFIG.VIRTUAL_HEIGHT);

            // Beam core sparks
            for (let k = 0; k < 3; k++) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(
                boss.beamX - boss.x + (Math.random() - 0.5) * beamW * 0.6,
                50 + Math.random() * (CONFIG.VIRTUAL_HEIGHT - 100),
                6,
                14
              );
            }
          }
          ctx.restore();
        }

        // Boss shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, boss.height / 2 + 10, boss.width * 0.45, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Boss aura
        const bAura = ctx.createRadialGradient(0, 0, 20, 0, 0, boss.width * 0.65);
        bAura.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
        bAura.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = bAura;
        ctx.beginPath();
        ctx.arc(0, 0, boss.width * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // Boss Emoji Character
        ctx.font = `${boss.width}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(boss.emoji, 0, 0);

        // Boss Speech Bubble (Devil Laugh or "OH NO!")
        if (boss.speechText && boss.speechTimer && boss.speechTimer > 0) {
          ctx.save();
          const bubbleY = -boss.height / 2 - 32;
          ctx.font = 'bold 22px Fredoka, Outfit, sans-serif';
          const textMetrics = ctx.measureText(boss.speechText);
          const bubbleW = textMetrics.width + 32;
          const bubbleH = 38;

          // Bubble background & border with drop shadow
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = boss.speechColor || '#ffffff';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(-bubbleW / 2, bubbleY - bubbleH / 2, bubbleW, bubbleH, 14);
          ctx.fill();
          ctx.stroke();

          // Bubble pointer triangle
          ctx.beginPath();
          ctx.moveTo(-8, bubbleY + bubbleH / 2);
          ctx.lineTo(0, bubbleY + bubbleH / 2 + 10);
          ctx.lineTo(8, bubbleY + bubbleH / 2);
          ctx.fillStyle = boss.speechColor || '#ffffff';
          ctx.fill();
          ctx.stroke();

          // Bubble text
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(boss.speechText, 0, bubbleY);
          ctx.restore();
        }

        ctx.restore();
      }

      // G. DRAW ENDING CUTSCENE
      if (gameState === 'ending_cutscene') {
        drawEndingCutscene(ctx, g.cutscene, hero, princess, currentTime);
      }

      // H. DRAW PLAYER (IF ACTIVE IN LEVEL)
      if (gameState !== 'ending_cutscene') {
        ctx.save();
        ctx.translate(p.x, p.y);

        // Invincible blinking
        if (p.invincibleTimer > 0 && Math.floor(currentTime * 0.015) % 2 === 0) {
          ctx.globalAlpha = 0.4;
        }

        // Player shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, p.height / 2 + 4, p.width * 0.38, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hero Aura Circle
        const heroAura = ctx.createRadialGradient(0, 0, 10, 0, 0, 36);
        heroAura.addColorStop(0, `${hero.themeColor}55`);
        heroAura.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = heroAura;
        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        ctx.fill();

        // Hero Emoji
        ctx.font = `${p.width}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hero.emoji, 0, 0);

        // Energy Shield Bubble (if active)
        if (p.shield) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(0, 0, p.width * 0.65, 0, Math.PI * 2);
          ctx.stroke();

          // Rotating sparkles on shield
          const sAngle = currentTime * 0.003;
          for (let s = 0; s < 3; s++) {
            const rot = sAngle + (s * Math.PI * 2) / 3;
            const sx = Math.cos(rot) * (p.width * 0.65);
            const sy = Math.sin(rot) * (p.width * 0.65);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      }

      // I. DRAW PARTICLES
      for (const pt of g.particles) {
        ctx.save();
        ctx.globalAlpha = pt.alpha;
        if (pt.isEmoji && pt.emojiChar) {
          ctx.translate(pt.x, pt.y);
          if (pt.rotation) ctx.rotate(pt.rotation);
          ctx.font = `${pt.size * 2.2}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pt.emojiChar, 0, 0);
        } else {
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // J. DRAW FLOATING TEXTS
      for (const ft of g.floatingTexts) {
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 22px Fredoka, Outfit, sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore();
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, currentLevel, hero, princess, isPaused, autoFire, checkAndSaveHighScore, createBossForLevel, score]);

  // ==========================================
  // 🌄 DRAW WORLD BACKGROUND PER LEVEL
  // ==========================================
  const drawBackground = (ctx: CanvasRenderingContext2D, lvl: number, state: GameState) => {
    const W = CONFIG.VIRTUAL_WIDTH;
    const H = CONFIG.VIRTUAL_HEIGHT;

    if (state === 'ending_cutscene') {
      // Golden romantic sunset meadow
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#fde68a'); // Warm sunset yellow
      grad.addColorStop(0.4, '#f472b6'); // Soft rose
      grad.addColorStop(0.7, '#818cf8'); // Twilight violet
      grad.addColorStop(1, '#34d399'); // Green meadow
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Rolling lush green ground
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(W / 2, H - 40, W * 0.7, 100, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cottage house on the right
      const houseX = W - 170;
      const houseY = H - 170;

      // House body
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(houseX - 45, houseY - 30, 90, 80);

      // Roof
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(houseX, houseY - 80);
      ctx.lineTo(houseX - 60, houseY - 30);
      ctx.lineTo(houseX + 60, houseY - 30);
      ctx.closePath();
      ctx.fill();

      // Door & Window
      ctx.fillStyle = '#b45309';
      ctx.fillRect(houseX - 14, houseY + 15, 28, 35);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(houseX - 32, houseY - 15, 20, 20);
      ctx.fillRect(houseX + 12, houseY - 15, 20, 20);

      // Chimney & smoke puffs
      ctx.fillStyle = '#78350f';
      ctx.fillRect(houseX + 25, houseY - 70, 16, 28);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(houseX + 33, houseY - 85, 10, 0, Math.PI * 2);
      ctx.arc(houseX + 42, houseY - 105, 14, 0, Math.PI * 2);
      ctx.fill();

      return;
    }

    if (lvl === 1) {
      // Sunny Emerald Meadow
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#38bdf8'); // Sky blue
      grad.addColorStop(0.65, '#bae6fd');
      grad.addColorStop(0.85, '#4ade80'); // Green hills
      grad.addColorStop(1, '#15803d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (lvl === 2) {
      // Snow-capped Mountain
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#1e293b'); // Navy twilight
      grad.addColorStop(0.4, '#334155');
      grad.addColorStop(0.75, '#64748b');
      grad.addColorStop(1, '#0284c7');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (lvl === 3) {
      // Molten Volcano
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#450a0a'); // Dark crimson
      grad.addColorStop(0.5, '#7f1d1d');
      grad.addColorStop(0.8, '#c2410c'); // Magma orange
      grad.addColorStop(1, '#ea580c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (lvl === 4) {
      // Primeval Jungle Swamp
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#064e3b'); // Deep jungle emerald
      grad.addColorStop(0.5, '#065f46');
      grad.addColorStop(0.8, '#047857');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      // Level 5: Dark Royal Citadel
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#1e1b4b'); // Deep cosmic purple
      grad.addColorStop(0.4, '#2e1065');
      grad.addColorStop(0.75, '#3b0764');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  };

  // ==========================================
  // 🏰 DRAW ENDING RESCUE CUTSCENE
  // ==========================================
  const drawEndingCutscene = (
    ctx: CanvasRenderingContext2D,
    cs: CutsceneState,
    h: HeroOption,
    p: PrincessOption,
    currentTime: number
  ) => {
    // 1. Draw Dungeon Cage (if not fully dissolved)
    if (!cs.cageBroken || cs.stage === 'unlocking') {
      ctx.save();
      ctx.translate(cs.princessX, cs.cageY);

      // Cage Bars
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 6;
      ctx.strokeRect(-60, -65, 120, 130);

      // Vertical bars
      for (let x = -40; x <= 40; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, -65);
        ctx.lineTo(x, 65);
        ctx.stroke();
      }

      // Padlock
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cs.stage === 'unlocking' ? '🗝️' : '🔒', 0, 0);

      ctx.restore();
    }

    // 2. Draw Princess
    ctx.save();
    ctx.translate(cs.princessX, cs.princessY);
    // Bobbing animation
    const bob = Math.sin(currentTime * 0.008) * 4;
    ctx.font = '58px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.emoji, 0, bob);
    ctx.restore();

    // 3. Draw Hero
    ctx.save();
    ctx.translate(cs.heroX, cs.heroY);
    const heroBob = Math.sin(currentTime * 0.008 + 1) * 4;
    ctx.font = '58px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(h.emoji, 0, heroBob);
    ctx.restore();

    // 4. Floating Love Hearts between them when embraced or walking
    if (cs.stage === 'embraced' || cs.stage === 'walking_home' || cs.stage === 'house_arrival') {
      ctx.save();
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('❤️', (cs.heroX + cs.princessX) / 2, cs.princessY - 45 + Math.sin(currentTime * 0.006) * 6);
      ctx.restore();
    }
  };

  // Next level handler
  const handleNextLevel = () => {
    if (currentLevel < 5) {
      startLevel(currentLevel + 1);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-screen h-screen bg-slate-950 flex items-center justify-center overflow-hidden select-none"
    >
      {/* ==========================================
          CANVAS VIEWPORT
      ========================================== */}
      <div className="relative aspect-[4/5] max-h-full max-w-full h-full flex items-center justify-center shadow-2xl">
        <canvas
          ref={canvasRef}
          width={CONFIG.VIRTUAL_WIDTH}
          height={CONFIG.VIRTUAL_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full object-contain cursor-crosshair touch-none"
        />

        {/* ==========================================
            HUD OVERLAY (TOP STATUS CLUSTER)
        ========================================== */}
        {(gameState === 'playing' || gameState === 'boss_fight' || gameState === 'boss_warning') && (
          <div className="absolute top-0 left-0 right-0 p-3 sm:p-5 pointer-events-none flex flex-col gap-2 z-10">
            {/* Top row: Lives, Score, Level, Settings */}
            <div className="flex items-center justify-between text-white drop-shadow-md">
              {/* Hearts / Lives */}
              <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/60 shadow-lg">
                {Array.from({ length: CONFIG.PLAYER_MAX_LIVES }).map((_, i) => (
                  <Heart
                    key={i}
                    size={22}
                    className={`transition-all duration-300 ${
                      i < hudLives 
                        ? 'text-rose-500 fill-rose-500 scale-100' 
                        : 'text-slate-600 fill-slate-800 scale-90 opacity-40'
                    }`}
                  />
                ))}
              </div>

              {/* Score Display */}
              <div className="flex flex-col items-center bg-slate-900/80 backdrop-blur-md px-4 py-1 rounded-2xl border border-slate-700/60 shadow-lg">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Score</span>
                <span className="text-xl sm:text-2xl font-black tabular-nums tracking-tight text-white">
                  {score.toLocaleString()}
                </span>
              </div>

              {/* Action Buttons: Auto-Fire, Mute, Pause */}
              <div className="flex items-center gap-1.5 pointer-events-auto">
                {/* Auto Fire Toggle */}
                <button
                  onClick={() => setAutoFire(!autoFire)}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                    autoFire 
                      ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-amber-500/30' 
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
                  title="Toggle Auto Fire"
                >
                  <Flame size={18} />
                  <span className="hidden sm:inline">Auto</span>
                </button>

                {/* Common Install Button in HUD */}
                <button
                  onClick={handleUniversalInstall}
                  className={`p-2 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    isInstalled
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                      : 'bg-gradient-to-r from-sky-500 to-blue-600 border-sky-400 text-white shadow-md shadow-sky-500/25 active:scale-95'
                  }`}
                  title={isInstalled ? 'Game Installed on Device' : 'Install the Game (Phone, Tab, PC)'}
                >
                  {isInstalled ? <Check size={16} /> : <Download size={16} />}
                  <span className="hidden sm:inline">{isInstalled ? 'Installed' : 'Install'}</span>
                </button>

                {/* Share Button */}
                <button
                  onClick={() => setShowShareModal(true)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-amber-400 hover:text-amber-300 transition-all flex items-center gap-1 cursor-pointer"
                  title="Share Game with Friends"
                >
                  <Share2 size={18} />
                </button>

                {/* Sound Toggle */}
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                {/* Pause Button */}
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all cursor-pointer"
                  title="Pause Game"
                >
                  {isPaused ? <Play size={18} /> : <Pause size={18} />}
                </button>
              </div>
            </div>

            {/* Wave Progress Bar (During Barrier Phase) */}
            {gameState === 'playing' && (
              <div className="flex items-center gap-2 bg-slate-900/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/50 max-w-md mx-auto w-full">
                <span className="text-xs font-bold text-slate-300 whitespace-nowrap">
                  Level {currentLevel} Wave
                </span>
                <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-200"
                    style={{ width: `${hudProgress * 100}%` }}
                  />
                </div>
                <span className="text-xs font-black text-amber-400">
                  {Math.round(hudProgress * 100)}%
                </span>
              </div>
            )}

            {/* Boss HP Bar & Progress (Compact in Top-Right Corner) */}
            {gameState === 'boss_fight' && hudBossHp && (
              <div className="self-end flex flex-col gap-1.5 bg-slate-950/92 backdrop-blur-md px-3.5 py-2 rounded-2xl border-2 border-rose-500/70 shadow-2xl w-52 sm:w-64 pointer-events-none animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xl leading-none animate-bounce">{hudBossHp.emoji}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-black uppercase tracking-wider text-rose-300 truncate leading-tight">
                        {hudBossHp.name}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90 leading-tight">
                        Boss Progress
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-black tabular-nums text-white bg-rose-950/80 px-2 py-0.5 rounded-lg border border-rose-800/60 shadow-inner">
                      {hudBossHp.current} / {hudBossHp.max} Hits
                    </span>
                    <span className="text-[9px] font-extrabold tabular-nums text-slate-300 mt-0.5">
                      {Math.round((hudBossHp.current / hudBossHp.max) * 100)}% HP
                    </span>
                  </div>
                </div>

                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-rose-900/70">
                  <div 
                    className={`h-full rounded-full transition-all duration-150 shadow-md ${
                      hudBossHp.current / hudBossHp.max <= 0.3
                        ? 'bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 animate-pulse'
                        : 'bg-gradient-to-r from-amber-400 via-rose-500 to-red-600'
                    }`}
                    style={{ width: `${(hudBossHp.current / hudBossHp.max) * 100}%` }}
                  />
                </div>

                {/* Voice & Emote Reaction Status */}
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">Reaction:</span>
                  {hudBossHp.current / hudBossHp.max > 0.6 ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <span>😈</span> <span>"MWAHAHA!"</span>
                    </span>
                  ) : hudBossHp.current / hudBossHp.max > 0.3 ? (
                    <span className="text-orange-400 flex items-center gap-1">
                      <span>😠</span> <span>"GRAAAGH!"</span>
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1 animate-pulse font-black">
                      <span>😱</span> <span>"OH NO!" (Losing!)</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Active Powerups Indicator Cluster */}
            <div className="flex items-center gap-2">
              {hudPowerups.rapidFire > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-500/90 text-slate-950 font-black text-xs px-2.5 py-1 rounded-full shadow-lg">
                  <Zap size={14} className="fill-slate-950" />
                  <span>Rapid {Math.ceil(hudPowerups.rapidFire)}s</span>
                </div>
              )}
              {hudPowerups.tripleShot > 0 && (
                <div className="flex items-center gap-1.5 bg-purple-500/90 text-white font-black text-xs px-2.5 py-1 rounded-full shadow-lg">
                  <Sparkles size={14} className="fill-white" />
                  <span>Triple {Math.ceil(hudPowerups.tripleShot)}s</span>
                </div>
              )}
              {hudPowerups.shield && (
                <div className="flex items-center gap-1.5 bg-sky-500/90 text-slate-950 font-black text-xs px-2.5 py-1 rounded-full shadow-lg">
                  <Shield size={14} className="fill-slate-950" />
                  <span>Shield Active</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            LEVEL INTRO BANNER OVERLAY
        ========================================== */}
        {gameState === 'intro_banner' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm z-30 pointer-events-none animate-in fade-in zoom-in duration-300">
            <div className="text-center bg-slate-900/90 border-2 border-amber-400 p-8 rounded-3xl shadow-2xl max-w-md w-full">
              <span className="text-5xl block mb-3 animate-bounce">👑</span>
              <h2 className="text-2xl sm:text-3xl font-black text-amber-400 uppercase tracking-tight mb-2">
                {introTitle}
              </h2>
              <p className="text-slate-300 text-sm font-semibold mb-4 leading-relaxed">
                {introSubtitle}
              </p>
              <div className="h-1.5 w-24 bg-amber-500 rounded-full mx-auto animate-pulse" />
            </div>
          </div>
        )}

        {/* ==========================================
            BOSS INCOMING WARNING BANNER
        ========================================== */}
        {gameState === 'boss_warning' && (
          <div className="absolute inset-x-0 top-1/3 flex flex-col items-center justify-center p-6 bg-red-600/35 border-y-4 border-red-500 backdrop-blur-sm z-20 pointer-events-none animate-pulse">
            <span className="text-5xl mb-2">⚠️ 👹 ⚠️</span>
            <h2 className="text-3xl sm:text-4xl font-black text-red-100 uppercase tracking-widest drop-shadow-lg text-center">
              BOSS INCOMING!
            </h2>
            <p className="text-yellow-300 font-bold text-sm tracking-wide mt-1">
              PREPARE FOR BATTLE!
            </p>
          </div>
        )}

        {/* ==========================================
            START SCREEN & CHARACTER SELECTION
        ========================================== */}
        {gameState === 'start' && (
          <div className="absolute inset-0 flex flex-col items-center justify-between p-6 sm:p-8 bg-slate-950/90 backdrop-blur-md z-40 overflow-y-auto">
            {/* Title Lockup */}
            <div className="text-center mt-2 sm:mt-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-4xl sm:text-5xl">👑</span>
                <span className="text-3xl sm:text-4xl">👸</span>
                <span className="text-4xl sm:text-5xl">⚔️</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-300 to-amber-400 drop-shadow-sm">
                Rescue the Princess
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm font-semibold mt-1">
                Blast through 5 perilous worlds to save your true love!
              </p>
            </div>

            {/* Character Selection Cards */}
            <div className="flex flex-col gap-4 w-full max-w-md my-4">
              {/* Choose Hero */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block mb-2">
                  Choose Your Hero
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {HEROES.map((h, idx) => (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHeroIndex(idx)}
                      className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition-all ${
                        selectedHeroIndex === idx
                          ? 'border-amber-400 bg-amber-500/20 scale-105 shadow-md shadow-amber-500/20'
                          : 'border-slate-800 bg-slate-800/50 hover:bg-slate-800 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <span className="text-3xl mb-1">{h.emoji}</span>
                      <span className="text-xs font-bold text-white truncate max-w-full">{h.name}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-center text-xs text-amber-200/90 font-medium">
                  {hero.title} · <span className="text-slate-400">{hero.perk}</span>
                </div>
              </div>

              {/* Choose Princess */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-400 block mb-2">
                  Choose Princess to Rescue
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {PRINCESSES.map((pr, idx) => (
                    <button
                      key={pr.id}
                      onClick={() => setSelectedPrincessIndex(idx)}
                      className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition-all ${
                        selectedPrincessIndex === idx
                          ? 'border-rose-400 bg-rose-500/20 scale-105 shadow-md shadow-rose-500/20'
                          : 'border-slate-800 bg-slate-800/50 hover:bg-slate-800 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <span className="text-3xl mb-1">{pr.emoji}</span>
                      <span className="text-xs font-bold text-white truncate max-w-full">{pr.name.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-center text-xs text-rose-200/90 font-medium">
                  {princess.title} · <span className="text-slate-400 italic">"{princess.quote}"</span>
                </div>
              </div>
            </div>

            {/* High Score & Start Button CTA */}
            <div className="flex flex-col items-center gap-3 w-full max-w-md pb-4">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold bg-amber-950/40 border border-amber-800/50 px-4 py-1.5 rounded-full">
                <Trophy size={16} />
                <span>High Score: {highScore.toLocaleString()}</span>
              </div>

              {/* Common Install the Game Button (Phone, Tab, PC) */}
              <button
                onClick={handleUniversalInstall}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-base shadow-xl shadow-sky-500/30 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer border-2 border-sky-300/40"
              >
                {isInstalled ? (
                  <Check size={20} className="text-emerald-300" />
                ) : (
                  <Download size={20} className="animate-bounce" />
                )}
                <span>{isInstalled ? 'Game Installed on This Device ✓' : 'Install the Game (Phone, Tab & PC)'}</span>
                {!isInstalled && (
                  <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Auto
                  </span>
                )}
              </button>

              <button
                onClick={handleStartGame}
                className="w-full py-4 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 bg-size-200 hover:bg-right transition-all duration-500 rounded-2xl text-slate-950 font-black text-xl shadow-xl shadow-amber-500/25 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Tap or Press Space to Start</span>
                <ArrowRight size={22} />
              </button>

              <div className="flex items-center justify-between w-full text-xs text-slate-400 px-1 pt-1">
                <button
                  onClick={() => {
                    setActiveShareTab('share');
                    setShowShareModal(true);
                  }}
                  className="hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer font-bold text-slate-300"
                >
                  <Share2 size={14} className="text-amber-400" />
                  <span>Share Game Link & QR</span>
                </button>
                <span className="text-[11px] font-medium text-slate-400">Desktop: A/D/Arrows · Space</span>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            LEVEL CLEAR MODAL
        ========================================== */}
        {gameState === 'level_clear' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md z-40 animate-in fade-in zoom-in duration-300">
            <div className="bg-slate-900 border-2 border-emerald-400/80 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
              <span className="text-5xl block mb-2">⭐ 🎉 ⭐</span>
              <h2 className="text-3xl font-black text-emerald-400 uppercase tracking-tight mb-2">
                Level {currentLevel} Complete!
              </h2>
              <p className="text-slate-300 text-sm mb-6 font-medium">
                The boss has fallen! You are one step closer to Princess {princess.name}!
              </p>

              <div className="bg-slate-800/80 rounded-2xl p-4 mb-6 border border-slate-700">
                <div className="flex justify-between items-center text-sm font-semibold text-slate-400 mb-1">
                  <span>Current Score</span>
                  <span className="text-amber-400 font-bold">{score.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-slate-400">
                  <span>Lives Remaining</span>
                  <span className="text-rose-400 font-bold">❤️ {hudLives}</span>
                </div>
              </div>

              <button
                onClick={handleNextLevel}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue to Level {currentLevel + 1}</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* ==========================================
            GAME OVER MODAL
        ========================================== */}
        {gameState === 'game_over' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-950/85 backdrop-blur-md z-40 animate-in fade-in zoom-in duration-300">
            <div className="bg-slate-900 border-2 border-rose-500/80 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
              <span className="text-5xl block mb-2">💔 💀</span>
              <h2 className="text-3xl font-black text-rose-500 uppercase tracking-tight mb-2">
                Game Over
              </h2>
              <p className="text-slate-300 text-sm mb-6 font-medium">
                The enemies overwhelmed you! But hope is not lost.
              </p>

              <div className="bg-slate-800/80 rounded-2xl p-4 mb-6 border border-slate-700">
                <div className="flex justify-between items-center text-sm font-semibold text-slate-400 mb-1">
                  <span>Final Score</span>
                  <span className="text-amber-400 font-bold">{score.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-slate-400">
                  <span>Best Record</span>
                  <span className="text-emerald-400 font-bold">{highScore.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleRetryLevel}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw size={20} />
                  <span>Retry Level {currentLevel}</span>
                </button>

                <button
                  onClick={() => setGameState('start')}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                >
                  Return to Title Screen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            PAUSE MODAL
        ========================================== */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md z-40">
            <div className="bg-slate-900 border-2 border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
              <Pause size={42} className="mx-auto text-amber-400 mb-3" />
              <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                Game Paused
              </h2>
              <p className="text-slate-400 text-xs mb-6">
                Take a breather! Ready to jump back into action?
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => setIsPaused(false)}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base rounded-2xl shadow-md cursor-pointer"
                >
                  Resume Playing
                </button>
                <button
                  onClick={handleUniversalInstall}
                  className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Download size={16} />
                  <span>{isInstalled ? 'Game Installed on Device ✓' : 'Install Game on Device'}</span>
                </button>
                <button
                  onClick={toggleMute}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  <span>{isMuted ? 'Unmute Audio' : 'Mute Audio'}</span>
                </button>
                <button
                  onClick={() => {
                    setIsPaused(false);
                    setGameState('start');
                  }}
                  className="w-full py-2 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Quit to Main Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            GRAND ENDING VICTORY RESCUE SCREEN
        ========================================== */}
        {gameState === 'ending_cutscene' && (
          <div className="absolute inset-x-0 bottom-4 sm:bottom-8 flex flex-col items-center justify-center p-4 z-40 pointer-events-auto">
            <div className="bg-slate-900/90 border-2 border-amber-400/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-2xl max-w-md w-full text-center animate-in fade-in slide-in-from-bottom duration-500">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-3xl">🎉</span>
                <span className="text-4xl">👸</span>
                <span className="text-3xl">💖</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-amber-300 uppercase tracking-tight mb-1">
                You Saved the Princess! 🎉
              </h2>
              <p className="text-rose-200 text-xs sm:text-sm font-semibold mb-4">
                "{princess.quote}"
              </p>

              {/* Final Adventure Statistics */}
              <div className="grid grid-cols-2 gap-2 bg-slate-800/80 rounded-2xl p-3.5 mb-5 border border-slate-700 text-left text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Final Score</span>
                  <span className="text-amber-400 font-black text-base">{gameStats.totalScore.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Bosses Defeated</span>
                  <span className="text-emerald-400 font-black text-base">5 / 5 Complete</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Accuracy</span>
                  <span className="text-sky-400 font-black text-base">{gameStats.accuracy}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Adventure Time</span>
                  <span className="text-purple-400 font-black text-base">{gameStats.timeSeconds}s</span>
                </div>
              </div>

              <button
                onClick={() => setGameState('start')}
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 text-slate-950 font-black text-lg rounded-2xl shadow-xl shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw size={20} />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        )}

        {/* ==========================================
            SHARE & INSTALL (PWA) MODAL
        ========================================== */}
        {showShareModal && (
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md z-50 animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 border-2 border-slate-700 p-5 sm:p-6 rounded-3xl shadow-2xl max-w-md w-full relative max-h-[92vh] overflow-y-auto">
              {/* Close Button */}
              <button
                onClick={() => setShowShareModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Modal Header */}
              <div className="text-center mb-4">
                <div className="inline-flex p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-2xl mb-1.5">
                  📱
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  Share & Install Game
                </h3>
                <p className="text-slate-400 text-xs">
                  Play on your phone, tablet, or desktop with offline PWA support!
                </p>
              </div>

              {/* Tabs Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl mb-4 border border-slate-800">
                <button
                  onClick={() => setActiveShareTab('share')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeShareTab === 'share'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Share2 size={14} />
                  <span>Share Game</span>
                </button>
                <button
                  onClick={() => setActiveShareTab('install')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeShareTab === 'install'
                      ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Download size={14} />
                  <span>Install App (PWA)</span>
                </button>
              </div>

              {/* TAB 1: SHARE GAME */}
              {activeShareTab === 'share' && (
                <div className="flex flex-col items-center gap-4">
                  {/* QR Code for Mobile Scanning */}
                  <div className="flex flex-col items-center bg-white p-3 rounded-2xl shadow-lg border-2 border-amber-400/50">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}&margin=6`}
                      alt="Game QR Code"
                      className="w-40 h-40 rounded-xl"
                    />
                    <span className="text-[11px] font-black text-slate-900 mt-1.5 flex items-center gap-1">
                      <QrCode size={13} />
                      <span>Scan with phone camera to play</span>
                    </span>
                  </div>

                  {/* Share URL & Copy Link */}
                  <div className="w-full flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded-xl">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="bg-transparent text-xs text-slate-300 w-full outline-none font-mono truncate px-1"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                        copiedLink
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm'
                      }`}
                    >
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>

                  {/* Native Share Button */}
                  <button
                    onClick={handleNativeShare}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Share2 size={16} />
                    <span>Send Link to Friends (WhatsApp, SMS, etc.)</span>
                  </button>
                </div>
              )}

              {/* TAB 2: INSTALL APP (PWA MANIFEST) */}
              {activeShareTab === 'install' && (
                <div className="flex flex-col gap-3 text-left">
                  {/* Status Banner */}
                  {isInstalled ? (
                    <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl flex items-center gap-2 text-emerald-300 text-xs font-bold">
                      <Check size={18} className="text-emerald-400 shrink-0" />
                      <span>Game is already installed on this device! Launches full-screen with offline support.</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-sky-950/60 border border-sky-500/50 rounded-xl flex items-center gap-2 text-sky-200 text-xs">
                      <Smartphone size={20} className="text-sky-400 shrink-0" />
                      <span>Manifested with full Progressive Web App (PWA) compliance: offline caching, fast load, and full-screen immersion.</span>
                    </div>
                  )}

                  {/* Chromium / Android / Desktop 1-Click Install */}
                  {isInstallable && !isInstalled && (
                    <button
                      onClick={install}
                      className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-sm rounded-xl shadow-lg shadow-sky-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download size={18} />
                      <span>Install App Now (Add to Home Screen)</span>
                    </button>
                  )}

                  {/* iOS Safari Guided Steps */}
                  <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-slate-800 flex flex-col gap-2">
                    <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                      <span>🍎</span> For iPhone & iPad (Safari)
                    </span>
                    <ol className="text-xs text-slate-300 space-y-1.5 pl-4 list-decimal leading-relaxed">
                      <li>Open this game URL in <strong>Safari</strong>.</li>
                      <li>Tap the <strong>Share button</strong> <span className="inline-block bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-[11px]">⎋</span> at the bottom toolbar.</li>
                      <li>Scroll down and tap <strong>"Add to Home Screen"</strong> <span className="inline-block bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-[11px]">⊞</span>.</li>
                      <li>Tap <strong>Add</strong> in the top-right corner.</li>
                    </ol>
                  </div>

                  {/* Android / Chrome Manual Steps */}
                  <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-slate-800 flex flex-col gap-2">
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                      <span>🤖</span> For Android & Desktop (Chrome / Edge)
                    </span>
                    <ol className="text-xs text-slate-300 space-y-1.5 pl-4 list-decimal leading-relaxed">
                      <li>Tap the <strong>Three Dots (⋮)</strong> menu in the browser.</li>
                      <li>Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                      <li>Open directly from your device home screen or app drawer!</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            INSTALL SUCCESS TOAST NOTIFICATION
        ========================================== */}
        {installSuccessToast && (
          <div className="absolute top-6 inset-x-0 mx-auto w-fit z-50 flex items-center gap-2.5 bg-emerald-500 text-slate-950 px-5 py-3 rounded-2xl shadow-2xl font-black text-sm border-2 border-emerald-300 animate-in fade-in slide-in-from-top duration-300">
            <span className="text-xl">🎉</span>
            <span>Game Installed Successfully! Added to your Home Screen.</span>
          </div>
        )}

        {/* ==========================================
            MOBILE CONTROLS (FIRE BUTTON)
        ========================================== */}
        {(gameState === 'playing' || gameState === 'boss_fight') && !autoFire && (
          <div className="absolute bottom-5 right-5 z-20 pointer-events-auto sm:hidden">
            <button
              onPointerDown={() => {
                gameRef.current.isFiring = true;
              }}
              onPointerUp={() => {
                gameRef.current.isFiring = false;
              }}
              className="w-20 h-20 rounded-full bg-rose-500 active:bg-rose-600 border-4 border-rose-300 text-white font-black text-lg shadow-2xl shadow-rose-500/50 flex flex-col items-center justify-center active:scale-90 transition-transform touch-none"
            >
              <Flame size={24} />
              <span className="text-[11px] uppercase tracking-wider">FIRE</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
