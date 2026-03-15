import React from "react";

// Custom SVG emojis - no system emojis
export const FireEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} animate-emoji-pulse`} fill="none">
    <defs>
      <linearGradient id="fire-grad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="50%" stopColor="#ef4444" />
        <stop offset="100%" stopColor="#f97316" />
      </linearGradient>
    </defs>
    <path d="M12 2C8 6 4 10 4 14a8 8 0 0016 0c0-4-4-8-8-12zm0 18a6 6 0 01-6-6c0-3.5 3-6.5 6-10 3 3.5 6 6.5 6 10a6 6 0 01-6 6z" fill="url(#fire-grad)" />
    <path d="M12 20a3 3 0 01-3-3c0-2 1.5-3.5 3-5.5 1.5 2 3 3.5 3 5.5a3 3 0 01-3 3z" fill="#fbbf24" />
  </svg>
);

export const PackageEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} animate-emoji-float`} fill="none">
    <defs>
      <linearGradient id="pkg-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" fill="url(#pkg-grad)" opacity="0.2" stroke="url(#pkg-grad)" strokeWidth="1.5" />
    <path d="M3 7l9 4 9-4M12 11v10" stroke="url(#pkg-grad)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7.5 4.5L16.5 9" stroke="hsl(263 70% 58%)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
  </svg>
);

export const MoneyEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} animate-emoji-float`} fill="none">
    <defs>
      <linearGradient id="money-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#34d399" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#money-grad)" opacity="0.15" stroke="url(#money-grad)" strokeWidth="1.5" />
    <path d="M12 6v12M9 9.5c0-1.1 1.3-2 3-2s3 .9 3 2-1.3 2-3 2-3 .9-3 2 1.3 2 3 2 3-.9 3-2" stroke="url(#money-grad)" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const ShieldEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} animate-emoji-glow text-accent`} fill="none">
    <defs>
      <linearGradient id="shield-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <path d="M12 2l8 4v6c0 5.5-3.8 10-8 11-4.2-1-8-5.5-8-11V6l8-4z" fill="url(#shield-grad)" opacity="0.15" stroke="url(#shield-grad)" strokeWidth="1.5" />
    <path d="M9 12l2 2 4-4" stroke="url(#shield-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const HeadsetEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} animate-emoji-float`} fill="none">
    <defs>
      <linearGradient id="headset-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
    <path d="M3 18v-6a9 9 0 0118 0v6" stroke="url(#headset-grad)" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="1" y="14" width="4" height="6" rx="2" fill="url(#headset-grad)" opacity="0.3" stroke="url(#headset-grad)" strokeWidth="1" />
    <rect x="19" y="14" width="4" height="6" rx="2" fill="url(#headset-grad)" opacity="0.3" stroke="url(#headset-grad)" strokeWidth="1" />
    <path d="M21 18c0 2-2 3-4 3h-3" stroke="url(#headset-grad)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const StarEmoji = ({ className = "w-4 h-4", filled = true }: { className?: string; filled?: boolean }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <defs>
      <linearGradient id="star-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill={filled ? "url(#star-grad)" : "none"}
      stroke="url(#star-grad)"
      strokeWidth="1.5"
    />
  </svg>
);

export const DoorEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none">
    <defs>
      <linearGradient id="door-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ef4444" />
        <stop offset="100%" stopColor="#f97316" />
      </linearGradient>
    </defs>
    <rect x="4" y="2" width="14" height="20" rx="2" fill="url(#door-grad)" opacity="0.15" stroke="url(#door-grad)" strokeWidth="1.5" />
    <circle cx="15" cy="12" r="1.5" fill="url(#door-grad)" />
    <path d="M9 22V2" stroke="url(#door-grad)" strokeWidth="1" opacity="0.3" />
  </svg>
);

export const RocketEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} animate-emoji-float`} fill="none">
    <defs>
      <linearGradient id="rocket-grad" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <path d="M12 2C8 6 6 10 6 14l3 3 6 0 3-3c0-4-2-8-6-12z" fill="url(#rocket-grad)" opacity="0.2" stroke="url(#rocket-grad)" strokeWidth="1.5" />
    <circle cx="12" cy="11" r="2" fill="url(#rocket-grad)" />
    <path d="M6 14l-2 4 4-2M18 14l2 4-4-2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 17l-1 4h6l-1-4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const HeartEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} animate-emoji-pulse`} fill="none">
    <defs>
      <linearGradient id="heart-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill="url(#heart-grad)" opacity="0.3" stroke="url(#heart-grad)" strokeWidth="1.5" />
  </svg>
);

export const KeyEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} animate-emoji-glow text-neon-green`} fill="none">
    <defs>
      <linearGradient id="key-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <circle cx="8" cy="15" r="5" fill="url(#key-grad)" opacity="0.15" stroke="url(#key-grad)" strokeWidth="1.5" />
    <path d="M11.5 11.5L22 2M17 2h5v5M17 7l-2-2" stroke="url(#key-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CameraEmoji = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none">
    <defs>
      <linearGradient id="cam-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
    <rect x="2" y="6" width="20" height="14" rx="3" fill="url(#cam-grad)" opacity="0.15" stroke="url(#cam-grad)" strokeWidth="1.5" />
    <circle cx="12" cy="13" r="4" stroke="url(#cam-grad)" strokeWidth="1.5" />
    <path d="M8 2h8l2 4H6l2-4z" fill="url(#cam-grad)" opacity="0.2" />
  </svg>
);

export const ChatEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} animate-emoji-float`} fill="none">
    <defs>
      <linearGradient id="chat-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
    </defs>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="url(#chat-grad)" opacity="0.15" stroke="url(#chat-grad)" strokeWidth="1.5" />
    <circle cx="9" cy="10" r="1" fill="url(#chat-grad)" className="animate-emoji-pulse" />
    <circle cx="12" cy="10" r="1" fill="url(#chat-grad)" className="animate-emoji-pulse" style={{ animationDelay: "0.2s" }} />
    <circle cx="15" cy="10" r="1" fill="url(#chat-grad)" className="animate-emoji-pulse" style={{ animationDelay: "0.4s" }} />
  </svg>
);
