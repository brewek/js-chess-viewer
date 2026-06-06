import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chess-board': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        fen?: string;
        orientation?: 'white' | 'black';
        coordinates?: 'none' | 'classic' | 'full';
      };
    }
  }
}
