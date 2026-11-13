import React, { useCallback, useState } from 'react';
import Intro from './components/Intro.jsx';
import MainMenu from './components/MainMenu.jsx';
import GameView from './components/GameView.jsx';
import AnalysisView from './analysis/AnalysisView.jsx';

export default function App() {
  const [screen, setScreen] = useState('intro'); // intro | menu | playing | analysis
  const finishIntro = useCallback(() => setScreen('menu'), []);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState(null);

  const play = () => {
    setRun((r) => r + 1);
    setScreen('playing');
  };

  if (screen === 'intro') return <Intro onComplete={finishIntro} />;

  if (screen === 'playing') {
    return (
      <GameView
        key={run}
        onFinish={(res) => {
          setResult(res);
          setScreen('analysis');
        }}
        onExit={() => setScreen('menu')}
      />
    );
  }
  if (screen === 'analysis' && result) {
    return <AnalysisView result={result} onRetry={play} onMenu={() => setScreen('menu')} />;
  }
  return <MainMenu onPlay={play} />;
}
