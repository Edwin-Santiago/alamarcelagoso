import { assetUrl } from '../assetUrl.js';
import React from 'react';
import './MainMenu.css';

function Word({ children, offset = 0 }) {
  return <span className="rr-word">{[...children].map((letter, index) => (
    <span className="rr-letter" style={{ '--letter': index + offset }} key={index}><span>{letter}</span></span>
  ))}</span>;
}

function FeatureIcon({ type }) {
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'heart' && <path d="M24 40 7 24C-6 10 14-1 24 13 34-1 54 10 41 24Z" />}
    {type === 'nitro' && <><path d="M7 37a21 21 0 1 1 34 0H7Z M24 5v6 M7 14l5 4 M41 14l-5 4 M4 28h7 M44 28h-7 M24 29l9-11" /><circle cx="24" cy="29" r="3" /></>}
    {type === 'level' && <><path d="M6 32h6v11H6z M21 21h6v22h-6z M36 6h6v37h-6z" fill="currentColor" stroke="none" /></>}
  </svg>;
}

const features = [
  { type: 'heart', title: '3 VIDAS', text: 'Cada maniobra cuenta' },
  { type: 'nitro', title: 'NITRO', text: 'Un impulso extra' },
  { type: 'level', title: 'NIVELES', text: 'Más velocidad cada 600 m' },
];

export default function MainMenu({ onPlay }) {
  return (
    <main className="rr-menu">
      <img className="rr-menu__art" src={assetUrl('branding/menu-desert.png')} alt="" fetchpriority="high" />
      <div className="rr-menu__shade" aria-hidden="true" />

      <header className="rr-menu__header">
        <div className="rr-brand">
          <img src={assetUrl('branding/road-rush-logo.png')} alt="" width="96" height="96" />
          <span>ROAD RUSH <b>3D</b></span>
        </div>
        <span className="rr-project">PROYECTO <i>•</i> ANÁLISIS NUMÉRICO</span>
      </header>

      <section className="rr-menu__hero" aria-labelledby="rr-title">
        <p className="rr-eyebrow">EL DESIERTO TE ESPERA <span aria-hidden="true" /></p>
        <h1 id="rr-title" aria-label="Road Rush 3D">
          <span aria-hidden="true"><Word>ROAD</Word><span className="rr-title-row"><Word offset={4}>RUSH</Word><b className="rr-badge">3D</b></span></span>
        </h1>
        <p className="rr-description">Esquiva rocas y huecos. Lleva tus reflejos al límite.</p>
        <button className="rr-play" onClick={onPlay}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2 23 12 5 22Z" fill="currentColor" /></svg>
          <span>JUGAR AHORA</span><span className="rr-play__arrow" aria-hidden="true">⟶</span>
        </button>
        <p className="rr-analysis-note">Cada partida termina con tu análisis numérico.</p>
      </section>

      <section className="rr-features" aria-label="Características del juego">
        {features.map((feature, index) => <article className="rr-feature" style={{ '--card': index }} key={feature.type}>
          <FeatureIcon type={feature.type} />
          <div><h2>{feature.title}</h2><p>{feature.text}</p></div>
        </article>)}
      </section>

      <footer className="rr-controls" aria-label="Controles del teclado">
        <span><kbd>W</kbd> Acelerar</span>
        <span><kbd>S</kbd> Frenar</span>
        <span><span className="rr-direction"><kbd>A</kbd><i>/</i><kbd>D</kbd></span> Dirección</span>
        <span><kbd>P</kbd> Pausa</span>
        <span><kbd>M</kbd> Sonido</span>
      </footer>
    </main>
  );
}
