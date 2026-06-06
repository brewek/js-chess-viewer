const fs = require('fs');
const https = require('https');

const pieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
const urlBase = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/';
const map = {
  'wK': 'K', 'wQ': 'Q', 'wR': 'R', 'wB': 'B', 'wN': 'N', 'wP': 'P',
  'bK': 'k', 'bQ': 'q', 'bR': 'r', 'bB': 'b', 'bN': 'n', 'bP': 'p'
};

let result = 'const DEFAULT_PIECES: PieceMap = {\n';
let count = 0;

pieces.forEach(p => {
  https.get(`${urlBase}${p}.svg`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      // Clean up the svg a bit to inline it properly
      const cleanSvg = data.replace(/\r?\n|\r/g, '').replace(/"/g, "'");
      result += `  '${map[p]}': "${cleanSvg}",\n`;
      count++;
      if (count === pieces.length) {
        result += '};\n';
        fs.writeFileSync('pieces.ts', result);
        console.log('Done');
      }
    });
  });
});
