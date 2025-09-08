import React from 'react';

interface AuraMedLoaderProps {
  active: boolean;
}

const AuraMedLoader: React.FC<AuraMedLoaderProps> = ({ active }) => {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[9999] auramed-overlay backdrop-blur-sm">
      {/* Floating dark patches */}
      <div className="auramed-blob b1" />
      <div className="auramed-blob b2" />
      <div className="auramed-blob b3" />
      <div className="auramed-blob b4" />

      {/* Centered content */}
      <div className="relative h-full w-full flex items-center justify-center">
        <div className="text-center select-none" role="status" aria-live="polite">
          <div className="relative">
            <div className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-widest auramed-text drop-shadow-[0_6px_16px_rgba(14,165,233,0.25)]">
              AURAMED
            </div>
            {/* Sapphire glow under text */}
            <div className="auramed-glow" />
          </div>
          {/* Animated progress underline */}
          <div className="auramed-progress"><span /></div>
          <div className="mt-4 text-xs sm:text-sm text-slate-300/80">Preparing your experience…</div>
        </div>
      </div>
    </div>
  );
};

export default AuraMedLoader;
