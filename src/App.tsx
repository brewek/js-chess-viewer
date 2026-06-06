import React, { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessBoardElement } from './components/chessboard-component';
import './components/theme.css';

const App: React.FC = () => {
  const boardRef = useRef<ChessBoardElement>(null);
  const [game] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [evalBar, setEvalBar] = useState(0);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./engine.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'eval') {
        setEvalBar(e.data.score);
      }
    };

    workerRef.current.postMessage({ type: 'position', fen: game.fen() });

    return () => {
      workerRef.current?.terminate();
    };
  }, [game]);

  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return;

    const handleMoveAttempt = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { source, target } = customEvent.detail;

      try {
        const move = game.move({
          from: source,
          to: target,
          promotion: 'q', // Always promote to queen for simplicity in this example
        });

        if (move) {
          const newFen = game.fen();
          setFen(newFen);

          workerRef.current?.postMessage({ type: 'position', fen: newFen });

          boardEl.setHighlights([source, target]);
          boardEl.setArrows([{ from: source, to: target }]);
        }
      } catch {
        // Force the Web Component to snap back to the current valid FEN by re-rendering
        boardEl.revertState();
      }
    };

    boardEl.addEventListener('move-attempt', handleMoveAttempt);

    return () => {
      boardEl.removeEventListener('move-attempt', handleMoveAttempt);
    };
  }, [game]);

  const resetGame = () => {
    game.reset();
    setFen(game.fen());
    boardRef.current?.setHighlights([]);
    boardRef.current?.setArrows([]);
    workerRef.current?.postMessage({ type: 'position', fen: game.fen() });
  };

  return (
    <div
      style={{
        padding: '2rem',
        display: 'flex',
        gap: '2rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <div className="board-container theme-wood" style={{ width: '100%', maxWidth: '600px' }}>
        <chess-board
          ref={boardRef}
          fen={fen}
          orientation="white"
          coordinates="classic"
        ></chess-board>
      </div>

      <div
        className="controls"
        style={{
          minWidth: '200px',
          backgroundColor: '#f9f9f9',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #eee',
        }}
      >
        <h2>React + Web Component</h2>
        <p>
          Current Eval: <strong>{evalBar > 0 ? `+${evalBar}` : evalBar}</strong>
        </p>
        <button
          onClick={resetGame}
          style={{
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            background: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          Reset Game
        </button>
        <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
          <p>Drag & Drop or Click to Move</p>
        </div>
      </div>
    </div>
  );
};

export default App;
