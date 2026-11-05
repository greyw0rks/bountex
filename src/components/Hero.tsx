import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
const RewardScene = lazy(() => import('./RewardScene'));
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export function Hero({ browse, create }: { browse: () => void; create: () => void }) {
  const reduced = !!useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false),
    [available, setAvailable] = useState(true);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    setAvailable(!!context);
    if (context)
      (context.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
    const observer = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: '50px',
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-grid" />
      <div className="hero-copy">
        <div className="eyebrow hero-eyebrow">
          <span className="tiny-hex" /> GOOD WORK PAYS.
        </div>
        <h1 id="hero-title">
          Small tasks.
          <br />
          <span>Big possibilities.</span>
        </h1>
        <p>
          Put your skills to work. Find your next bounty,
          <br className="desktop-break" /> do something useful, and earn NIM.
        </p>
        <div className="hero-actions">
          <button className="button primary" onClick={browse}>
            Find a bounty <ArrowUpRight size={18} />
          </button>
          <button className="hero-secondary" onClick={create}>
            Post a bounty <span>↗</span>
          </button>
        </div>
      </div>
      <div ref={host} className="hero-art" aria-hidden="true">
        <div className="art-glow" />
        <div className="fallback-token">B</div>
        {visible && available && (
          <SceneBoundary>
            <Suspense fallback={null}>
              <div className="canvas-wrap">
                <RewardScene reduced={reduced} onError={() => setAvailable(false)} />
              </div>
            </Suspense>
          </SceneBoundary>
        )}
        <div className="floating-label label-earned">
          <span className="label-icon">
            <Sparkles size={14} />
          </span>
          <span>Skills into rewards</span>
        </div>
        <div className="floating-label label-task">
          <span className="small-live" /> YOUR NEXT OPPORTUNITY
        </div>
        <span className="art-star star-one">✦</span>
        <span className="art-star star-two">✧</span>
      </div>
    </section>
  );
}
