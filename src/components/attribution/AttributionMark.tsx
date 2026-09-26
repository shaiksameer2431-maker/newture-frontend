import React from 'react';
import { Sparkles } from 'lucide-react';
import { useAttribution } from './useAttribution';

export interface AttributionMarkProps {
  variant?: 'floating' | 'footer' | 'header' | 'input' | 'subfooter' | 'pill' | 'welcome' | 'inline';
  className?: string;
}

export const AttributionMark: React.FC<AttributionMarkProps> = ({
  variant = 'floating',
  className = ''
}) => {
  const { attribution, isVerified } = useAttribution();

  if (!isVerified || !attribution) {
    return null;
  }

  const name = attribution.displayName || attribution.name;
  const rollNo = attribution.rollNo;

  if (variant === 'floating') {
    return (
      <aside
        id="crafted-by-watermark"
        className={`fixed bottom-4 left-4 z-40 bg-slate-900/90 hover:bg-slate-900 border border-slate-700/80 text-slate-300 backdrop-blur-md px-3 py-1.5 rounded-full shadow-xl text-[11px] font-medium flex items-center gap-2 transition-all hover:border-blue-500/50 hover:text-white group select-none pointer-events-auto ${className}`}
        title={`Project Designer & Developer: ${name} (Roll No: ${rollNo})`}
      >
        <span className="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition-transform animate-pulse" />
        <span className="text-slate-400">Crafted by</span>
        <span className="font-bold text-blue-400 group-hover:text-blue-300">{name}</span>
        {rollNo && (
          <span className="text-[10px] bg-blue-950/80 text-blue-300 border border-blue-800/50 px-1.5 py-0.2 rounded font-mono">
            {rollNo}
          </span>
        )}
      </aside>
    );
  }

  if (variant === 'footer') {
    return (
      <span className={`text-blue-400 dark:text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-[11px] ${className}`}>
        {name} {rollNo ? `(${rollNo})` : ''}
      </span>
    );
  }

  if (variant === 'pill' || variant === 'welcome') {
    return (
      <div className={`pt-2 text-[11px] text-slate-300 font-mono bg-slate-950/80 py-1.5 px-3 rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 flex-wrap ${className}`}>
        <span className="text-slate-400">Crafted & Engineered by</span>
        <span className="text-blue-400 font-bold">{name}</span>
        {rollNo && (
          <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800/60 px-1.5 py-0.2 rounded font-mono">
            {rollNo}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <span className={`text-blue-400 font-medium ${className}`}>
        {name} {rollNo ? `(${rollNo})` : ''}
      </span>
    );
  }

  if (variant === 'input' || variant === 'subfooter') {
    return (
      <span className={`text-[10px] text-slate-400/60 dark:text-slate-500/60 font-mono tracking-tight select-none ${className}`}>
        Crafted by <span className="text-blue-500/70 dark:text-blue-400/60 font-medium">{name}</span> {rollNo ? <span className="opacity-75">({rollNo})</span> : ''}
      </span>
    );
  }

  return (
    <span className={`text-blue-400 font-semibold ${className}`}>
      {name} {rollNo ? `(${rollNo})` : ''}
    </span>
  );
};

export default AttributionMark;
