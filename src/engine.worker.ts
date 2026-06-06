// A dummy web worker to simulate a heavy chess engine like Stockfish

self.onmessage = (e) => {
  const { type, fen } = e.data;
  if (type === 'position') {
    setTimeout(() => {
      // Very crude evaluation: just counting material difference for this dummy example
      // In a real scenario, you'd communicate with stockfish.js here
      const evalScore = evaluatePosition(fen);
      self.postMessage({ type: 'eval', score: evalScore });
    }, 500);
  }
};

function evaluatePosition(fen: string): number {
  const pieces = fen.split(' ')[0];
  const values: Record<string, number> = {
    p: -1,
    n: -3,
    b: -3,
    r: -5,
    q: -9,
    k: 0,
    P: 1,
    N: 3,
    B: 3,
    R: 5,
    Q: 9,
    K: 0,
  };
  let score = 0;
  for (const char of pieces) {
    if (values[char]) {
      score += values[char];
    }
  }
  return score;
}
