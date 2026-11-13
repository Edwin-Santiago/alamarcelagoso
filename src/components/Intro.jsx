import { assetUrl } from '../assetUrl.js';
import React, { useEffect, useState } from 'react';
import './Intro.css';

export default function Intro({ onComplete }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // También permite entrar si la imagen falla o tarda demasiado en cargar.
    const fallback = window.setTimeout(onComplete, 6500);
    const onKey = (event) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        onComplete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener('keydown', onKey);
    };
  }, [onComplete]);

  useEffect(() => {
    if (!ready) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(onComplete, reduced ? 1000 : 3800);
    return () => window.clearTimeout(timer);
  }, [ready, onComplete]);

  return (
    <section className={`intro${ready ? ' intro--ready' : ''}`} aria-label="Bienvenido a Road Rush 3D">
      <div className="intro__halo" aria-hidden="true" />
      <div className="intro__streaks" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i }} />)}
      </div>
      <div className="intro__content">
        <div className="intro__logo-wrap">
          <img
            className="intro__logo"
            src={assetUrl('branding/road-rush-logo.png')}
            alt="Road Rush 3D: deportivo turquesa en una carretera desértica"
            width="1280"
            height="1280"
            fetchpriority="high"
            onLoad={() => setReady(true)}
            onError={onComplete}
          />
        </div>
        <p className="intro__tagline">EL DESIERTO TE ESPERA</p>
        <div className="intro__line" aria-hidden="true"><span /></div>
      </div>
      <button className="intro__skip" onClick={onComplete}>Saltar intro <span aria-hidden="true">→</span></button>
    </section>
  );
}
