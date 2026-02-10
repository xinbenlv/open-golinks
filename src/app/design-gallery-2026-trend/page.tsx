'use client';

import React, { useState, useEffect } from 'react';

export default function DesignGallery2026Trends(): JSX.Element {
  const [_activeSection, _setActiveSection] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Hero Section with Animated Background */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-pink-600/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="mb-6 inline-block">
              <span className="text-sm font-mono text-cyan-400 tracking-widest uppercase">2026 Design Trends</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-black mb-6 leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
                The Future of
              </span>
              <br />
              <span className="text-white">Web Design</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Eight design philosophies defining the next era of intentional, craft-driven digital experiences
            </p>
          </div>
        </div>
      </section>

      {/* Trends Grid */}
      <section className="relative z-20 px-4 py-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 1. Proprietary Effects & Styles */}
          <TrendCard
            number="01"
            title="Proprietary Effects"
            subtitle="Unique, Unmistakable Motion"
            description="Brands develop distinctive visual systems with custom animations that feel authentically theirs, moving away from generic algorithmic design."
            preview={<ProprietaryEffectsPreview />}
            accent="from-purple-500 to-violet-500"
          />

          {/* 2. Art + Advanced UI */}
          <TrendCard
            number="02"
            title="Art + Advanced UI"
            subtitle="Sophistication Meets Craft"
            description="Vintage illustration and classical aesthetics paired with sophisticated interactions signal human craft and gallery-like presentation."
            preview={<ArtAdvancedUIPreview />}
            accent="from-amber-500 to-orange-500"
          />

          {/* 3. Minimalist Copy */}
          <TrendCard
            number="03"
            title="Minimalist Copy"
            subtitle="Radical Brevity Wins"
            description="Saying less becomes counter-cultural. White space and intentional silence communicate confidence and respect user attention."
            preview={<MinimalistCopyPreview />}
            accent="from-slate-400 to-slate-500"
          />

          {/* 4. TL;DR Experiences */}
          <TrendCard
            number="04"
            title="TL;DR Experiences"
            subtitle="Pitch Deck Clarity"
            description="Structured overviews let users grasp information instantly, with optional deeper exploration for complex B2B offerings."
            preview={<TLDRExperiencePreview />}
            accent="from-blue-500 to-cyan-500"
          />

          {/* 5. Color System Expansion */}
          <TrendCard
            number="05"
            title="Color System Expansion"
            subtitle="Full Palette Confidence"
            description="Complete color systems deployed throughout, not just accent colors. Signals sophistication and visual confidence."
            preview={<ColorSystemPreview />}
            accent="from-rose-500 to-pink-500"
          />

          {/* 6. Dynamic Text Treatments */}
          <TrendCard
            number="06"
            title="Dynamic Text Treatments"
            subtitle="Typography in Motion"
            description="Animated, bold typography emphasizes important copy and makes reading intentional and rewarding."
            preview={<DynamicTextPreview />}
            accent="from-lime-400 to-emerald-500"
          />

          {/* 7. Guided Scrolling */}
          <TrendCard
            number="07"
            title="Guided Scrolling"
            subtitle="Progress & Wayfinding"
            description="Visual progress indicators and wayfinding maintain engagement by showing users their position and what's ahead."
            preview={<GuidedScrollingPreview />}
            accent="from-indigo-500 to-purple-500"
          />

          {/* 8. Intentional Interactions */}
          <TrendCard
            number="08"
            title="Intentional Interactions"
            subtitle="Meaningful Engagement"
            description="Craft-based design prioritizes meaningful interactions over algorithmic efficiency, respecting user attention."
            preview={<IntentionalInteractionsPreview />}
            accent="from-teal-500 to-cyan-500"
          />
        </div>
      </section>

      {/* Implementation Guide */}
      <section className="relative z-20 px-4 py-24 max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="text-4xl font-black mb-4">How to Implement</h2>
          <p className="text-gray-400 max-w-2xl">
            Each trend represents a distinct design philosophy. Choose based on your brand position and user expectations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 bg-gradient-to-br from-purple-900/30 to-purple-900/10 border border-purple-500/20 rounded-lg">
            <h3 className="text-lg font-bold text-purple-400 mb-3">For SaaS & Tools</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>✓ Proprietary Effects (brand differentiation)</li>
              <li>✓ Minimalist Copy (user focus)</li>
              <li>✓ TL;DR Experiences (clarity)</li>
              <li>✓ Guided Scrolling (user guidance)</li>
            </ul>
          </div>

          <div className="p-8 bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 border border-cyan-500/20 rounded-lg">
            <h3 className="text-lg font-bold text-cyan-400 mb-3">For Creative & Brand</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>✓ Art + Advanced UI (showcase)</li>
              <li>✓ Dynamic Text Treatments (emphasis)</li>
              <li>✓ Color System Expansion (identity)</li>
              <li>✓ Intentional Interactions (craft)</li>
            </ul>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        @keyframes textReveal {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(100, 255, 218, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(100, 255, 218, 0.6);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes slideInRight {
          0% {
            opacity: 0;
            transform: translateX(40px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .animate-shimmer {
          animation: shimmer 3s infinite;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.2),
            transparent
          );
          background-size: 1000px 100%;
        }

        .animate-text-reveal {
          animation: textReveal 0.8s ease-out;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-slide-in {
          animation: slideInRight 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}

/* Trend Card Component */
function TrendCard({
  number,
  title,
  subtitle,
  description,
  preview,
  accent,
}: {
  number: string;
  title: string;
  subtitle: string;
  description: string;
  preview: React.ReactNode;
  accent: string;
}): JSX.Element {
  return (
    <div className="group relative">
      {/* Background glow effect */}
      <div className={`absolute inset-0 bg-gradient-to-r ${accent} opacity-0 group-hover:opacity-20 rounded-2xl blur-2xl transition-opacity duration-500`}></div>

      {/* Card */}
      <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-sm group-hover:border-gray-700 transition-all duration-300 h-full flex flex-col">
        {/* Number Badge */}
        <div className={`absolute top-6 right-6 text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r ${accent} opacity-10`}>
          {number}
        </div>

        {/* Preview */}
        <div className="relative h-80 overflow-hidden bg-gradient-to-b from-gray-800/50 to-gray-900/50">
          <div className="absolute inset-0 group-hover:scale-105 transition-transform duration-500">
            {preview}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 flex flex-col justify-between">
          <div>
            <h3 className={`text-2xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r ${accent}`}>
              {title}
            </h3>
            <p className="text-sm text-gray-400 font-medium mb-4">{subtitle}</p>
            <p className="text-sm leading-relaxed text-gray-300">{description}</p>
          </div>

          {/* Arrow indicator */}
          <div className="mt-6 inline-block">
            <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-200 transition-colors">
              <span className="text-xs uppercase tracking-widest">Explore</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Preview Components - Each demonstrates the trend */

function ProprietaryEffectsPreview(): JSX.Element {
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 p-8 flex flex-col justify-between relative overflow-hidden">
      {/* Custom animated shapes */}
      <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-2 border-purple-400/30 animate-float"></div>
      <div className="absolute bottom-8 left-8 w-24 h-24 rounded-full border-2 border-violet-400/20 animate-float" style={{ animationDelay: '1.5s' }}></div>

      <div className="relative z-10">
        <p className="text-xs uppercase tracking-widest text-purple-400/60 mb-3 font-mono">Custom Motion System</p>
        <h2 className="text-2xl font-black text-white mb-2">Unique Brand Motion</h2>
        <p className="text-sm text-gray-400">Proprietary animation language</p>
      </div>

      <div className="relative z-10 flex gap-2">
        <div className="w-12 h-12 bg-purple-500/20 rounded-lg border border-purple-400/40 animate-pulse-glow"></div>
        <div className="w-12 h-12 bg-violet-500/20 rounded-lg border border-violet-400/40 animate-pulse-glow" style={{ animationDelay: '0.5s' }}></div>
        <div className="w-12 h-12 bg-purple-600/20 rounded-lg border border-purple-400/40 animate-pulse-glow" style={{ animationDelay: '1s' }}></div>
      </div>
    </div>
  );
}

function ArtAdvancedUIPreview(): JSX.Element {
  return (
    <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-100 p-8 flex flex-col justify-between">
      {/* Decorative frame */}
      <div className="absolute inset-6 border-2 border-amber-800/20 rounded-lg pointer-events-none"></div>

      <div className="relative z-10">
        <div className="text-5xl mb-4">🎨</div>
        <h2 className="text-2xl font-bold text-amber-900 mb-1">Gallery View</h2>
        <p className="text-sm text-amber-700">Presented as art, not interface</p>
      </div>

      <div className="relative z-10 space-y-2">
        <div className="h-8 bg-gradient-to-r from-amber-200 to-orange-200 rounded-lg"></div>
        <div className="h-8 bg-gradient-to-r from-orange-200 to-rose-200 rounded-lg w-5/6"></div>
      </div>
    </div>
  );
}

function MinimalistCopyPreview(): JSX.Element {
  return (
    <div className="w-full h-full bg-white p-8 flex flex-col justify-between">
      <div className="text-center flex-1 flex flex-col justify-center">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-8">Less is more</p>
        <h2 className="text-3xl font-black text-black mb-6">Create</h2>
        <p className="text-xs text-gray-500">A link.</p>
      </div>

      <button className="w-full py-3 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-900 transition-colors">
        Go
      </button>
    </div>
  );
}

function TLDRExperiencePreview(): JSX.Element {
  return (
    <div className="w-full h-full bg-gradient-to-b from-blue-50 to-cyan-50 p-8 flex flex-col justify-between">
      {/* Pitch deck style sections */}
      <div className="space-y-4">
        <div className="bg-blue-100 rounded-lg p-3 border-l-4 border-blue-500">
          <p className="text-xs font-bold text-blue-900">01 Overview</p>
        </div>
        <div className="bg-cyan-100 rounded-lg p-3 border-l-4 border-cyan-500">
          <p className="text-xs font-bold text-cyan-900">02 Details</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-gray-300">
          <p className="text-xs font-bold text-gray-600">03 Deep Dive</p>
        </div>
      </div>

      <div className="flex gap-2 text-xs text-gray-600">
        <span>•••</span>
        <span>Progress: 1/3</span>
      </div>
    </div>
  );
}

function ColorSystemPreview(): JSX.Element {
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-950 to-gray-900 p-8 flex flex-col justify-between">
      {/* Full color system showcase */}
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-mono">Color System v2.0</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="h-12 bg-rose-500 rounded"></div>
          <div className="h-12 bg-amber-500 rounded"></div>
          <div className="h-12 bg-emerald-500 rounded"></div>
          <div className="h-12 bg-blue-500 rounded"></div>
          <div className="h-12 bg-indigo-500 rounded"></div>
          <div className="h-12 bg-purple-500 rounded"></div>
        </div>
      </div>

      <p className="text-xs text-gray-500">Full palette intentionality</p>
    </div>
  );
}

function DynamicTextPreview(): JSX.Element {
  return (
    <div className="w-full h-full bg-gradient-to-br from-black to-gray-900 p-8 flex flex-col justify-between relative overflow-hidden">
      {/* Animated text effect */}
      <div className="space-y-3">
        <div className="h-6 bg-gradient-to-r from-lime-400 via-emerald-400 to-lime-400 rounded animate-shimmer opacity-80"></div>
        <div className="h-4 bg-gradient-to-r from-gray-600 to-gray-500 rounded w-3/4"></div>
        <div className="h-4 bg-gradient-to-r from-gray-600 to-gray-500 rounded w-2/3" style={{ animationDelay: '0.2s' }}></div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></div>
        <p className="text-xs text-gray-400">Animated emphasis</p>
      </div>
    </div>
  );
}

function GuidedScrollingPreview(): JSX.Element {
  return (
    <div className="w-full h-full bg-gradient-to-b from-indigo-950 to-purple-950 p-8 flex flex-col justify-between">
      {/* Progress indicator */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-indigo-400 rounded-full"></div>
          <p className="text-xs text-gray-300">You are here</p>
        </div>
        <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full w-2/5 bg-gradient-to-r from-indigo-400 to-purple-400"></div>
        </div>
      </div>

      {/* Wayfinding */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400">Coming next:</p>
        <p className="text-sm font-bold text-indigo-300">→ Advanced Options</p>
      </div>
    </div>
  );
}

function IntentionalInteractionsPreview(): JSX.Element {
  return (
    <div className="w-full h-full bg-gradient-to-br from-teal-950 to-cyan-950 p-8 flex flex-col justify-between">
      {/* Meaningful interaction states */}
      <div className="space-y-3">
        <button className="w-full py-2 bg-teal-500/20 border border-teal-400/50 rounded-lg text-xs font-semibold text-teal-300 hover:bg-teal-500/30 transition-all duration-300 cursor-pointer">
          Hover me
        </button>
        <button className="w-full py-2 bg-cyan-500/20 border border-cyan-400/50 rounded-lg text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-all duration-300 cursor-pointer">
          Or me
        </button>
      </div>

      <p className="text-xs text-gray-400">Craft-based interactions</p>
    </div>
  );
}
