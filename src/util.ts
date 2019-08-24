import { Result, err, ok } from './fp';
import { Board, Square, Color, Role } from './types';

export function opposite(color: Color): Color {
  return color == 'white' ? 'black' : 'white';
}

export function charToRole(c: string): Result<Role> {
  switch (c) {
    case 'p': case 'P': return ok('pawn');
    case 'n': case 'N': return ok('knight');
    case 'b': case 'B': return ok('bishop');
    case 'r': case 'R': return ok('rook');
    case 'q': case 'Q': return ok('queen');
    case 'k': case 'K': return ok('king');
    default: return err();
  }
}

export function defined<A>(v: A | undefined): v is A {
  return typeof v !== 'undefined';
}

export function nthIndexOf(haystack: string, needle: string, n: number): number {
  let index = haystack.indexOf(needle);
  while (n-- > 0) {
    if (index == -1) break;
    index = haystack.indexOf(needle, index + 1);
  }
  return index;
}

export function strRepeat(str: string, num: number): string {
  let r = '';
  for (let i = 0; i < num; i++) r += str;
  return r;
}

export function arrayRemove<T>(arr: T[], element: T): void {
  while (true) {
    const index = arr.indexOf(element);
    if (index != -1) arr.splice(index, 1);
    else return;
  }
}
