import React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chess-board': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        fen?: string;
        orientation?: 'white' | 'black';
        coordinates?: 'none' | 'classic' | 'full';
        class?: string;
      };
    }
  }
}
