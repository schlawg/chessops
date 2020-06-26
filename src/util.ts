import { Color, Square, Role, Move, isDrop, SquareName } from './types';

export function defined<A>(v: A | undefined): v is A {
  return v !== undefined;
}

export function opposite(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

export function squareRank(square: Square): number {
  return square >> 3;
}

export function squareFile(square: Square): number {
  return square & 0x7;
}

export function squareDist(a: Square, b: Square): number {
  const x1 = squareFile(a), x2 = squareFile(b);
  const y1 = squareRank(a), y2 = squareRank(b);
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function roleToChar(role: Role): string {
  switch (role) {
  case 'pawn': return 'p';
  case 'knight': return 'n';
  case 'bishop': return 'b';
  case 'rook': return 'r';
  case 'queen': return 'q';
  case 'king': return 'k';
  }
}

export function charToRole(ch: 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'): Role;
export function charToRole(ch: string): Role | undefined;
export function charToRole(ch: string): Role | undefined {
  switch (ch) {
  case 'P': case 'p': return 'pawn';
  case 'N': case 'n': return 'knight';
  case 'B': case 'b': return 'bishop';
  case 'R': case 'r': return 'rook';
  case 'Q': case 'q': return 'queen';
  case 'K': case 'k': return 'king';
  default: return;
  }
}

export function parseSquare(str: SquareName): Square;
export function parseSquare(str: string): Square | undefined;
export function parseSquare(str: string): Square | undefined {
  if (!/^[a-h][1-8]$/.test(str)) return;
  return str.charCodeAt(0) - 'a'.charCodeAt(0) + 8 * (str.charCodeAt(1) - '1'.charCodeAt(0));
}

export function makeSquare(square: Square): SquareName {
  return ('abcdefgh'[squareFile(square)] + '12345678'[squareRank(square)]) as SquareName;
}

export function parseUci(str: string): Move | undefined {
  if (str[1] === '@' && str.length === 4) {
    const role = charToRole(str[0]);
    const to = parseSquare(str.slice(2));
    if (role && defined(to)) return { role, to };
  } else if (str.length === 4 || str.length === 5) {
    const from = parseSquare(str.slice(0, 2));
    const to = parseSquare(str.slice(2, 4));
    let promotion: Role | undefined;
    if (str.length === 5) {
      promotion = charToRole(str[4]);
      if (!promotion) return;
    }
    if (defined(from) && defined(to)) return { from, to, promotion };
  }
  return;
}

export function makeUci(move: Move): string {
  if (isDrop(move)) return `${roleToChar(move.role).toUpperCase()}@${makeSquare(move.to)}`;
  return makeSquare(move.from) + makeSquare(move.to) + (move.promotion ? roleToChar(move.promotion) : '');
}
