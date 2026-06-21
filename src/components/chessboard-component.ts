import { Chess } from 'chess.js';
import { DEFAULT_PIECES } from './pieces';

type PieceMap = Record<string, string>;

interface MoveAttemptDetail {
  source: string;
  target: string;
  piece: string;
}

export type BoardOrientation = 'white' | 'black';
export type BoardCoordinates = 'none' | 'classic' | 'full';

export interface Arrow {
  from: string;
  to: string;
  color?: string;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export class ChessBoardElement extends HTMLElement {
  private _fen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  private _orientation: BoardOrientation = 'white';
  private _coordinates: BoardCoordinates = 'classic';
  private _pieces: PieceMap = DEFAULT_PIECES;
  private _highlights: string[] = [];
  private _arrows: Arrow[] = [];

  private boardEl!: HTMLDivElement;
  private arrowsOverlay!: SVGSVGElement;
  private selectedSquare: string | null = null;
  private draggedPieceSquare: string | null = null;

  private renderScheduled = false;
  private squaresCreatedForOrientation: BoardOrientation | null = null;
  private squaresCreatedForCoordinates: BoardCoordinates | null = null;

  static get observedAttributes() {
    return ['fen', 'orientation', 'coordinates'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.renderSkeleton();
    this.renderBoard();
    this.setupEventListeners();
  }

  private scheduleRender() {
    if (!this.renderScheduled) {
      this.renderScheduled = true;
      requestAnimationFrame(() => {
        this.renderScheduled = false;
        if (this.boardEl) {
          this.renderBoard();
        }
      });
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    if (name === 'fen') this._fen = newValue;
    if (name === 'orientation') this._orientation = newValue as BoardOrientation;
    if (name === 'coordinates') this._coordinates = newValue as BoardCoordinates;
    this.scheduleRender();
  }

  get fen() {
    return this._fen;
  }
  set fen(val: string) {
    this.setAttribute('fen', val);
  }

  get orientation() {
    return this._orientation;
  }
  set orientation(val: BoardOrientation) {
    this.setAttribute('orientation', val);
  }

  get coordinates() {
    return this._coordinates;
  }
  set coordinates(val: BoardCoordinates) {
    this.setAttribute('coordinates', val);
  }

  set pieces(customPieces: PieceMap) {
    this._pieces = { ...DEFAULT_PIECES, ...customPieces };
    this.scheduleRender();
  }

  setHighlights(squares: string[]) {
    this._highlights = squares;
    this.updateHighlights();
  }

  setArrows(arrows: Arrow[]) {
    this._arrows = arrows;
    this.renderArrows();
  }

  private renderSkeleton() {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          max-width: var(--board-max-size, 100%);
          max-height: var(--board-max-size, 100%);
          aspect-ratio: 1;
          user-select: none;
          position: relative;
          --light-sq: var(--board-light, #f0d9b5);
          --dark-sq: var(--board-dark, #b58863);
          --highlight: var(--board-highlight, rgba(255, 255, 0, 0.4));
          --selected: var(--board-selected, rgba(20, 85, 30, 0.5));
          --coord-color-light: var(--board-dark, #b58863);
          --coord-color-dark: var(--board-light, #f0d9b5);
          --arrow-default: rgba(20, 130, 220, 0.8);
        }
        .board-container {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .board {
          display: grid;
          grid-template-columns: repeat(8, minmax(0, 1fr));
          grid-template-rows: repeat(8, minmax(0, 1fr));
          width: 100%;
          height: 100%;
          border: var(--board-border, 2px solid #333);
          box-sizing: border-box;
          position: absolute;
          inset: 0;
          z-index: 1;
        }
        .arrows-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 2; /* Over the board, under the pieces */
        }
        .square {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          min-width: 0;
          min-height: 0;
        }
        .square.light { background-color: var(--light-sq); }
        .square.dark { background-color: var(--dark-sq); }
        
        /* Highlights */
        .square::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }
        .square.highlighted::after { background-color: var(--highlight); }
        .square.selected::after { background-color: var(--selected); }

        /* Coordinates */
        .coord {
          position: absolute;
          font-family: sans-serif;
          font-size: clamp(0.6rem, 2vw, 0.9rem);
          font-weight: bold;
          pointer-events: none;
          z-index: 1;
        }
        .square.light .coord { color: var(--coord-color-light); }
        .square.dark .coord { color: var(--coord-color-dark); }
        
        .coord.rank { top: 2px; left: 2px; }
        .coord.file { bottom: 2px; right: 2px; }

        /* Pieces */
        .piece {
          width: var(--piece-scale, 95%);
          height: var(--piece-scale, 95%);
          cursor: grab;
          z-index: 3;
        }
        .piece svg {
          width: 100%;
          height: 100%;
          display: block;
        }
        .piece:active { cursor: grabbing; }
        .piece.dragging { opacity: 0.01; }
      </style>
      <div class="board-container">
        <div class="board"></div>
        <svg class="arrows-overlay" viewBox="0 0 800 800" preserveAspectRatio="none">
          <defs id="arrow-defs"></defs>
          <g id="arrows-group"></g>
        </svg>
      </div>
    `;
    this.boardEl = this.shadowRoot!.querySelector('.board')!;
    this.arrowsOverlay = this.shadowRoot!.querySelector('.arrows-overlay')!;
  }

  private renderBoard() {
    if (
      this.squaresCreatedForOrientation !== this._orientation ||
      this.squaresCreatedForCoordinates !== this._coordinates ||
      this.boardEl.children.length === 0
    ) {
      this.createSquares();
      this.squaresCreatedForOrientation = this._orientation;
      this.squaresCreatedForCoordinates = this._coordinates;
    }

    this.updatePieces();
    this.updateHighlights();
    this.renderArrows();
  }

  private createSquares() {
    this.boardEl.innerHTML = '';
    const files = [...FILES];
    const ranks = [...RANKS];

    if (this._orientation === 'black') {
      files.reverse();
      ranks.reverse();
    }

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const file = files[f];
        const rank = ranks[r];
        const sq = `${file}${rank}`;

        const isLight = (files.indexOf(file) + ranks.indexOf(rank)) % 2 !== 0;

        const squareEl = document.createElement('div');
        squareEl.className = `square ${isLight ? 'light' : 'dark'}`;
        squareEl.dataset.square = sq;

        if (this._coordinates !== 'none') {
          const showRank =
            this._coordinates === 'full' || file === (this._orientation === 'white' ? 'a' : 'h');
          const showFile =
            this._coordinates === 'full' || rank === (this._orientation === 'white' ? '1' : '8');

          if (showRank) {
            squareEl.innerHTML += `<div class="coord rank">${rank}</div>`;
          }
          if (showFile) {
            squareEl.innerHTML += `<div class="coord file">${file}</div>`;
          }
        }
        this.boardEl.appendChild(squareEl);
      }
    }
  }

  private updatePieces() {
    const layout = this.parseFEN(this._fen);
    const squares = this.boardEl.querySelectorAll('.square');

    squares.forEach((squareEl) => {
      const sq = (squareEl as HTMLElement).dataset.square!;
      const pieceChar = layout[sq];
      const existingPieceEl = squareEl.querySelector('.piece') as HTMLElement;

      if (pieceChar && this._pieces[pieceChar]) {
        if (existingPieceEl) {
          if (existingPieceEl.dataset.piece !== pieceChar) {
            existingPieceEl.dataset.piece = pieceChar;
            existingPieceEl.innerHTML = this._pieces[pieceChar];
          }
        } else {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'piece';
          pieceEl.draggable = true;
          pieceEl.dataset.piece = pieceChar;
          pieceEl.innerHTML = this._pieces[pieceChar];
          squareEl.appendChild(pieceEl);
        }
      } else if (existingPieceEl) {
        squareEl.removeChild(existingPieceEl);
      }
    });
  }

  private renderArrows() {
    const defs = this.arrowsOverlay.querySelector('#arrow-defs')!;
    const group = this.arrowsOverlay.querySelector('#arrows-group')!;

    defs.innerHTML = '';
    group.innerHTML = '';

    this._arrows.forEach((arrow, index) => {
      const color = arrow.color || 'var(--arrow-default)';
      const markerId = `arrowhead-${index}`;

      defs.innerHTML += `
        <marker id="${markerId}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}" />
        </marker>
      `;

      const c1 = this.getSquareCenter(arrow.from);
      const c2 = this.getSquareCenter(arrow.to);

      if (c1 && c2) {
        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const ratio = Math.max(0, length - 35) / length;
        const ex = c1.x + dx * ratio;
        const ey = c1.y + dy * ratio;

        group.innerHTML += `
          <line x1="${c1.x}" y1="${c1.y}" x2="${ex}" y2="${ey}" 
                stroke="${color}" stroke-width="16" stroke-linecap="round" 
                marker-end="url(#${markerId})" opacity="0.8" />
        `;
      }
    });
  }

  private getSquareCenter(sq: string): { x: number; y: number } | null {
    if (sq.length !== 2) return null;
    const file = sq[0];
    const rank = sq[1];

    let fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    let rankIndex = 8 - parseInt(rank);

    if (this._orientation === 'black') {
      fileIndex = 7 - fileIndex;
      rankIndex = 7 - rankIndex;
    }

    if (fileIndex < 0 || fileIndex > 7 || rankIndex < 0 || rankIndex > 7) return null;

    return {
      x: fileIndex * 100 + 50,
      y: rankIndex * 100 + 50,
    };
  }

  private updateHighlights() {
    if (!this.boardEl) return;
    this.boardEl.querySelectorAll('.square').forEach((sq) => {
      sq.classList.remove('highlighted', 'selected');
      const squareId = (sq as HTMLElement).dataset.square!;
      if (this._highlights.includes(squareId)) sq.classList.add('highlighted');
      if (this.selectedSquare === squareId) sq.classList.add('selected');
    });
  }

  private parseFEN(fen: string): Record<string, string> {
    const position = fen.split(' ')[0];
    const rows = position.split('/');
    const layout: Record<string, string> = {};

    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const char of rows[r]) {
        if (isNaN(Number(char))) {
          layout[`${FILES[f]}${8 - r}`] = char;
          f++;
        } else {
          f += Number(char);
        }
      }
    }
    return layout;
  }

  private setupEventListeners() {
    this.boardEl.addEventListener('dragstart', this.onDragStart.bind(this));
    this.boardEl.addEventListener('dragover', this.onDragOver.bind(this));
    this.boardEl.addEventListener('drop', this.onDrop.bind(this));
    this.boardEl.addEventListener('dragend', this.onDragEnd.bind(this));
    this.boardEl.addEventListener('click', this.onClick.bind(this));
  }

  private onDragStart(e: DragEvent) {
    const target = e.target as HTMLElement;
    const pieceEl = target.closest('.piece') as HTMLElement;
    if (!pieceEl) return;

    const squareEl = pieceEl.closest('.square') as HTMLElement;
    const sq = squareEl.dataset.square!;
    const piece = pieceEl.dataset.piece!;

    this.draggedPieceSquare = sq;
    this.selectedSquare = this.draggedPieceSquare;
    this.updateHighlights();

    e.dataTransfer!.setData('text/plain', JSON.stringify({ source: sq, piece: piece }));
    e.dataTransfer!.effectAllowed = 'move';

    setTimeout(() => pieceEl.classList.add('dragging'), 0);
  }

  private onDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  }

  private onDrop(e: DragEvent) {
    e.preventDefault();
    const targetEl = (e.target as HTMLElement).closest('.square') as HTMLElement;
    if (!targetEl || !this.draggedPieceSquare) return;

    const targetSquare = targetEl.dataset.square!;
    this.handleMoveAttempt(this.draggedPieceSquare, targetSquare);
    this.draggedPieceSquare = null;
  }

  private onDragEnd(e: DragEvent) {
    const pieceEl = e.target as HTMLElement;
    if (pieceEl) pieceEl.classList.remove('dragging');
    this.draggedPieceSquare = null;
  }

  private onClick(e: MouseEvent) {
    const squareEl = (e.target as HTMLElement).closest('.square') as HTMLElement;
    if (!squareEl) return;

    const clickedSquare = squareEl.dataset.square!;

    if (this.selectedSquare) {
      if (this.selectedSquare !== clickedSquare) {
        this.handleMoveAttempt(this.selectedSquare, clickedSquare);
      } else {
        this.selectedSquare = null;
        this.updateHighlights();
      }
    } else {
      const pieceEl = squareEl.querySelector('.piece');
      if (pieceEl) {
        this.selectedSquare = clickedSquare;
        this.updateHighlights();
      }
    }
  }

  private handleMoveAttempt(source: string, target: string) {
    const chess = new Chess(this._fen);
    try {
      chess.move({ from: source, to: target, promotion: 'q' });
    } catch {
      this.revertState();
      return;
    }

    const sourceSqEl = this.boardEl.querySelector(`[data-square="${source}"]`);
    const pieceEl = sourceSqEl?.querySelector('.piece') as HTMLElement;

    if (!pieceEl) return;

    const piece = pieceEl.dataset.piece!;
    this.selectedSquare = null;
    this.updateHighlights();

    const targetSqEl = this.boardEl.querySelector(`[data-square="${target}"]`);
    if (targetSqEl) {
      const existingPiece = targetSqEl.querySelector('.piece');
      if (existingPiece) targetSqEl.removeChild(existingPiece);
      targetSqEl.appendChild(pieceEl);
    }

    this.dispatchEvent(
      new CustomEvent<MoveAttemptDetail>('move-attempt', {
        detail: { source, target, piece },
        bubbles: true,
        composed: true,
      })
    );
  }

  public revertState() {
    this.renderBoard();
  }
}

if (!customElements.get('chess-board')) {
  customElements.define('chess-board', ChessBoardElement);
}
