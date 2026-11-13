import React, { useEffect, useId, useRef, useState } from 'react';
import './VoxelHearts.css';

// Silueta escalonada y caras extruidas: no depende de emojis ni de fuentes.
const HEART = 'M2 1H5V2H6V3H7V2H8V1H11V2H12V3H13V6H12V7H11V8H10V9H9V10H8V11H7V12H6V11H5V10H4V9H3V8H2V7H1V6H0V3H1V2H2Z';

function VoxelHeart({ filled, lost, last }) {
  const id = useId().replace(/:/g, '');
  return <span className={`voxel-heart ${filled ? 'is-full' : 'is-empty'}${lost ? ' is-lost' : ''}${last ? ' is-last' : ''}`} aria-hidden="true">
    <svg viewBox="-1 -1 17 16" focusable="false">
      <defs>
        <linearGradient id={`ruby${id}`} x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor={filled ? '#ff526c' : '#536179'} />
          <stop offset=".45" stopColor={filled ? '#f51e40' : '#2e3c51'} />
          <stop offset="1" stopColor={filled ? '#ae092c' : '#172436'} />
        </linearGradient>
      </defs>
      <path d={HEART} transform="translate(1.5 1.5)" fill={filled ? '#710923' : '#0c1422'} stroke="#070e19" strokeWidth=".8" strokeLinejoin="miter" />
      <path d="M13 3 14.5 4.5V7.5L13.5 8.5V9.5L12.5 10.5V11.5L11.5 12.5V13.5L8.5 13.5 7 12 8 11 9 10 10 9 11 8 12 7 13 6Z" fill={filled ? '#8c092a' : '#1a2637'} />
      <path d={HEART} fill={`url(#ruby${id})`} stroke="#080f1b" strokeWidth=".75" strokeLinejoin="miter" />
      <path d="M2.4 1.6H4.6V2.4H2.4ZM1.4 2.6H2.4V4.6H1.4ZM8.5 1.6H10.5V2.2H8.5Z" fill={filled ? '#fff1ee' : '#77879d'} opacity={filled ? '.95' : '.45'} />
      <path d="M3 7H4V8H5V9H6V10H7V11H6V10H5V9H4V8H3Z" fill={filled ? '#ff7284' : '#69758a'} opacity=".55" />
      <path d="M7 3H8V2H11V3H12V6H11V7H10V8H9V9H8V10H7" fill="none" stroke={filled ? '#ff6375' : '#52617a'} strokeWidth=".25" opacity=".5" />
    </svg>
    {lost && <span className="voxel-heart__chips"><i /><i /><i /></span>}
  </span>;
}

export default function VoxelHearts({ lives, maxLives = 3 }) {
  const previous = useRef(lives);
  const [lost, setLost] = useState([]);
  useEffect(() => {
    if (lives < previous.current) {
      setLost(Array.from({ length: previous.current - lives }, (_, i) => lives + i));
    } else setLost([]);
    previous.current = lives;
    const timer = window.setTimeout(() => setLost([]), 700);
    return () => window.clearTimeout(timer);
  }, [lives]);

  return <div className={`voxel-lives${lives === 1 ? ' is-critical' : ''}`} role="status" aria-label={`${lives} de ${maxLives} vidas`}>
    <div className="voxel-lives__label" aria-hidden="true"><span>VIDAS</span><b>{String(lives).padStart(2, '0')}<i> / {String(maxLives).padStart(2, '0')}</i></b></div>
    <div className="voxel-lives__row">
      {Array.from({ length: maxLives }, (_, i) => <VoxelHeart key={i} filled={i < lives} lost={lost.includes(i)} last={lives === 1 && i === 0} />)}
    </div>
  </div>;
}
