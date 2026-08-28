import React from 'react';

interface RobotLogoProps {
  className?: string;
  animate?: boolean;
}

export function RobotLogo({ className = "w-12 h-12", animate = true }: RobotLogoProps) {
  return (
    <svg 
      viewBox="0 0 500 500" 
      className={`${className} transition-all duration-300`} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Soft backlighting and shadow glows */}
        <filter id="robot-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.15" />
        </filter>
        <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.8" />
        </radialGradient>
        <filter id="eye-glow-filter">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main Group with Bobbing / Bounce Animation */}
      <g className={animate ? "animate-bounce-subtle" : ""} filter="url(#robot-shadow)">
        
        {/* ==================== 1. NECK & COLLAR/TIE SECTION ==================== */}
        {/* Outer Shadowed Neck Section */}
        <path d="M220 330 L280 330 L280 365 L220 365 Z" fill="#cbd5e1" />
        
        {/* Dark Slate Inner Collar back */}
        <path d="M190 350 L310 350 L315 375 L185 375 Z" fill="#1e293b" opacity="0.8" />

        {/* White Suit Collar lapels */}
        <path d="M185 370 L235 440 L220 445 L175 375 Z" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
        <path d="M315 370 L265 440 L280 445 L325 375 Z" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />

        {/* Blue-Navy Necktie */}
        <path d="M238 372 H262 L272 435 L250 455 L228 435 Z" fill="#1e3a8a" />
        {/* Necktie Highlight */}
        <path d="M250 372 L262 372 L272 435 L250 455 Z" fill="#2563eb" opacity="0.4" />

        {/* ==================== 2. MAIN HEAD BODY ==================== */}
        {/* Rounded head body - soft off-white/pure white */}
        <rect 
          x="145" 
          y="130" 
          width="210" 
          height="205" 
          rx="72" 
          ry="72" 
          fill="#ffffff" 
          stroke="#e2e8f0" 
          strokeWidth="6" 
        />
        
        {/* Front shadow contour for subtle 3D appearance */}
        <path 
          d="M148 245 C148 310, 352 310, 352 245 C352 315, 148 315, 148 245 Z" 
          fill="#cbd5e1" 
          opacity="0.4" 
        />

        {/* ==================== 3. EAR-PIECES / RED HEADPHONES ==================== */}
        {/* Headphone Connection Band */}
        <path 
          d="M160 160 C160 85, 340 85, 340 160" 
          stroke="#cbd5e1" 
          strokeWidth="14" 
          fill="none" 
          strokeLinecap="round" 
        />
        <path 
          d="M175 155 C175 95, 325 95, 325 155" 
          stroke="#f8fafc" 
          strokeWidth="4" 
          fill="none" 
          strokeLinecap="round" 
          opacity="0.7" 
        />

        {/* Left Ear-piece - Red Outer Case */}
        <path d="M145 180 C132 180, 122 205, 122 238 C122 271, 132 296, 145 296 Z" fill="#ef4444" />
        {/* Left Ear-piece - Grey/Metallic Accent */}
        <path d="M122 205 C114 205, 108 218, 108 238 C108 258, 114 271, 122 271 Z" fill="#94a3b8" />
        <path d="M145 190 H149 V286 H145 Z" fill="#dc2626" />

        {/* Right Ear-piece - Red Outer Case */}
        <path d="M355 180 C368 180, 378 205, 378 238 C378 271, 368 296, 355 296 Z" fill="#ef4444" />
        {/* Right Ear-piece - Grey/Metallic Accent */}
        <path d="M378 205 C386 205, 392 218, 392 238 C392 258, 386 271, 378 271 Z" fill="#94a3b8" />
        <path d="M355 190 H351 V286 H355 Z" fill="#dc2626" />

        {/* ==================== 4. VISOR & SCANNING PILL EYES ==================== */}
        {/* Sleek Slate/Blue Visor frame */}
        <rect 
          x="180" 
          y="190" 
          width="140" 
          height="54" 
          rx="27" 
          fill="#475569" 
          stroke="#334155" 
          strokeWidth="3" 
        />

        {/* Visor Glare/Reflective shine */}
        <path 
          d="M192 200 C220 195, 280 195, 308 200" 
          stroke="#64748b" 
          strokeWidth="3" 
          strokeLinecap="round" 
          opacity="0.5" 
        />

        {/* Dual Pill Eyes with Scanning Animation */}
        <g className={animate ? "animate-eye-scan" : ""}>
          {/* Left Pill Eye */}
          <rect 
            x="200" 
            y="207" 
            width="32" 
            height="20" 
            rx="10" 
            fill="url(#eyeGlow)" 
            filter="url(#eye-glow-filter)" 
          />
          {/* Right Pill Eye */}
          <rect 
            x="268" 
            y="207" 
            width="32" 
            height="20" 
            rx="10" 
            fill="url(#eyeGlow)" 
            filter="url(#eye-glow-filter)" 
          />
        </g>

        {/* ==================== 5. TOP ANTENNA ==================== */}
        {/* Antenna stalk */}
        <line x1="250" y1="85" x2="250" y2="130" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />
        <line x1="250" y1="90" x2="250" y2="120" stroke="#f1f5f9" strokeWidth="3" strokeLinecap="round" />
        
        {/* Antenna glowing orb */}
        <circle 
          cx="250" 
          y="76" 
          r="14" 
          fill="#ef4444" 
          className={animate ? "animate-pulse" : ""} 
        />
        {/* Tiny light flare inside antenna */}
        <circle 
          cx="246" 
          y="72" 
          r="4" 
          fill="#fca5a5" 
        />
      </g>
    </svg>
  );
}
