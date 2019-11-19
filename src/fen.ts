import { Result } from '@badrap/result';
import { Role, Piece, Square, Color, COLORS, ROLES } from './types';
import { SquareSet } from './squareSet';
import { Board } from './board';
import { Setup, MaterialSide, Material, RemainingChecks } from './setup';
import { defined, strRepeat, nthIndexOf, parseSquare, makeSquare, roleToChar, charToRole } from './util';

export const INITIAL_BOARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
export const INITIAL_FEN = INITIAL_BOARD_FEN + ' w KQkq - 0 1';
export const EMPTY_BOARD_FEN = '8/8/8/8/8/8/8/8';
export const EMPTY_FEN = EMPTY_BOARD_FEN + ' w - - 0 1';

export enum InvalidFen {
  Fen = 'ERR_FEN',
  Board = 'ERR_BOARD',
  Pockets = 'ERR_POCKETS',
  Turn = 'ERR_TURN',
  Castling = 'ERR_CASTLING',
  EpSquare = 'ERR_EP_SQUARE',
  RemainingChecks = 'ERR_REMAINING_CHECKS',
  Halfmoves = 'ERR_HALFMOVES',
  Fullmoves = 'ERR_FULLMOVES',
}

export class FenError extends Error { }

function parseSmallUint(str: string): number | undefined {
  return /^\d{1,4}$/.test(str) ? parseInt(str, 10) : undefined;
}

export function parseBoardFen(boardPart: string): Result<Board, FenError> {
  const board = Board.empty();
  let rank = 7, file = 0;
  for (let i = 0; i < boardPart.length; i++) {
    const c = boardPart[i];
    if (c == '/' && file == 8) {
      file = 0;
      rank--;
    } else {
      const step = parseInt(c, 10);
      if (step) file += step;
      else {
        if (file >= 8 || rank < 0) return Result.err(new FenError(InvalidFen.Board));
        const square = file + rank * 8;
        const piece = charToPiece(c);
        if (!piece) return Result.err(new FenError(InvalidFen.Board));
        if (boardPart[i + 1] == '~') {
          piece.promoted = true;
          i++;
        }
        board.set(square, piece);
        file++;
      }
    }
  }
  if (rank != 0 || file != 8) return Result.err(new FenError(InvalidFen.Board));
  return Result.ok(board);
}

export function parsePockets(pocketPart: string): Result<Material, FenError> {
  const pockets = Material.empty();
  for (const c of pocketPart) {
    const piece = charToPiece(c);
    if (!piece) return Result.err(new FenError(InvalidFen.Pockets));
    pockets[piece.color][piece.role]++;
  }
  return Result.ok(pockets);
}

export function parseCastlingFen(board: Board, castlingPart: string): Result<SquareSet, FenError> {
  let unmovedRooks = SquareSet.empty();
  if (castlingPart == '-') return Result.ok(unmovedRooks);
  if (!/^[KQABCDEFGH]{0,2}[kqabcdefgh]{0,2}$/.test(castlingPart)) {
    return Result.err(new FenError(InvalidFen.Castling));
  }
  for (const c of castlingPart) {
    const lower = c.toLowerCase();
    const color = c == lower ? 'black' : 'white';
    const rank = color == 'white' ? 0 : 7;
    const files = (lower == 'q') ? [0, 1, 2, 3, 4, 5, 6, 7] :
                  (lower == 'k') ? [7, 6, 5, 4, 3, 2, 1, 0] :
                                   [lower.charCodeAt(0) - 'a'.charCodeAt(0)];
    for (const file of files) {
      const square = file + 8 * rank;
      const piece = board.get(square);
      if (!piece) continue;
      if (piece.color == color && piece.role == 'king') break;
      if (piece.color == color && piece.role == 'rook') {
        unmovedRooks = unmovedRooks.with(square);
        break;
      }
    }
  }
  return Result.ok(unmovedRooks);
}

export function parseRemainingChecks(part: string): Result<RemainingChecks, FenError> {
  const parts = part.split('+');
  if (parts.length == 3 && parts[0] === '') {
    const white = parseSmallUint(parts[1]), black = parseSmallUint(parts[2]);
    if (!defined(white) || white > 3 || !defined(black) || black > 3) return Result.err(new FenError(InvalidFen.RemainingChecks));
    return Result.ok(new RemainingChecks(3 - white, 3 - black));
  } else if (parts.length == 2) {
    const white = parseSmallUint(parts[0]), black = parseSmallUint(parts[1]);
    if (!defined(white) || white > 3 || !defined(black) || black > 3) return Result.err(new FenError(InvalidFen.RemainingChecks));
    return Result.ok(new RemainingChecks(white, black));
  } else return Result.err(new FenError(InvalidFen.RemainingChecks));
}

export function parseFen(fen: string): Result<Setup, FenError> {
  const parts = fen.split(' ');
  const boardPart = parts.shift()!;

  // Board and pockets
  let board, pockets = Result.ok<Material | undefined, FenError>(undefined);
  if (boardPart.endsWith(']')) {
    const pocketStart = boardPart.indexOf('[');
    if (pocketStart == -1) return Result.err(new FenError(InvalidFen.Fen));
    board = parseBoardFen(boardPart.substr(0, pocketStart));
    pockets = parsePockets(boardPart.substr(pocketStart + 1, boardPart.length - 1 - pocketStart - 1));
  } else {
    const pocketStart = nthIndexOf(boardPart, '/', 7);
    if (pocketStart == -1) board = parseBoardFen(boardPart);
    else {
      board = parseBoardFen(boardPart.substr(0, pocketStart));
      pockets = parsePockets(boardPart.substr(pocketStart + 1));
    }
  }

  // Turn
  let turn: Color;
  const turnPart = parts.shift();
  if (!defined(turnPart) || turnPart == 'w') turn = 'white';
  else if (turnPart == 'b') turn = 'black';
  else return Result.err(new FenError(InvalidFen.Turn));

  return board.chain(board => {
    // Castling
    const castlingPart = parts.shift();
    const unmovedRooks = defined(castlingPart) ? parseCastlingFen(board, castlingPart) : Result.ok(SquareSet.empty());

    // En passant square
    const epPart = parts.shift();
    let epSquare: Square | undefined;
    if (defined(epPart) && epPart != '-') {
      epSquare = parseSquare(epPart);
      if (!defined(epSquare)) return Result.err(new FenError(InvalidFen.EpSquare));
    }

    // Halfmoves or remaining checks
    let halfmovePart = parts.shift();
    let earlyRemainingChecks: Result<RemainingChecks, FenError> | undefined;
    if (defined(halfmovePart) && halfmovePart.includes('+')) {
      earlyRemainingChecks = parseRemainingChecks(halfmovePart);
      halfmovePart = parts.shift();
    }
    const halfmoves = defined(halfmovePart) ? parseSmallUint(halfmovePart) : 0;
    if (!defined(halfmoves)) return Result.err(new FenError(InvalidFen.Halfmoves));

    const fullmovesPart = parts.shift();
    const fullmoves = defined(fullmovesPart) ? parseSmallUint(fullmovesPart) : 1;
    if (!defined(fullmoves)) return Result.err(new FenError(InvalidFen.Fullmoves));

    const remainingChecksPart = parts.shift();
    let remainingChecks: Result<RemainingChecks | undefined, FenError> = Result.ok(undefined);
    if (defined(remainingChecksPart)) {
      if (defined(earlyRemainingChecks)) return Result.err(new FenError(InvalidFen.RemainingChecks));
      remainingChecks = parseRemainingChecks(remainingChecksPart);
    } else if (defined(earlyRemainingChecks)) {
      remainingChecks = earlyRemainingChecks
    };

    if (parts.length) return Result.err(new FenError(InvalidFen.Fen));

    return pockets.chain(pockets => unmovedRooks.chain(unmovedRooks => remainingChecks.map(remainingChecks => {
      return {
        board,
        pockets,
        turn,
        unmovedRooks,
        remainingChecks,
        epSquare,
        halfmoves,
        fullmoves: Math.max(1, fullmoves)
      };
    })));
  });
}

interface FenOpts {
  promoted?: boolean;
  shredder?: boolean;
  epd?: boolean;
}

function charToPiece(ch: string): Piece | undefined {
  const lower = ch.toLowerCase();
  const role = charToRole(lower);
  if (!role) return;
  return { role, color: lower == ch ? 'black' : 'white' };
}

export function makePiece(piece: Piece, opts?: FenOpts): string {
  let r = roleToChar(piece.role);
  if (piece.color == 'white') r = r.toUpperCase();
  if (opts && opts.promoted && piece.promoted) r += '~';
  return r;
}

export function parsePiece(str: string): Piece | undefined {
  if (!str) return;
  const piece = charToPiece(str[0]);
  if (!piece) return;
  if (str.length == 2 && str[1] == '~') piece.promoted = true;
  else if (str.length > 1) return;
  return piece;
}

export function makeBoardFen(board: Board, opts?: FenOpts) {
  let fen = '', empty = 0;
  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = file + rank * 8;
      const piece = board.get(square);
      if (!piece) empty++;
      else {
        if (empty) {
          fen += empty;
          empty = 0;
        }
        fen += makePiece(piece, opts);
      }

      if (file == 7) {
        if (empty) {
          fen += empty;
          empty = 0;
        }
        if (rank != 0) fen += '/';
      }
    }
  }
  return fen;
}

function makePocket(material: MaterialSide): string {
  return ROLES.map(role => strRepeat(roleToChar(role), material[role])).join('');
}

export function makePockets(pocket: Material): string {
  return makePocket(pocket.white).toUpperCase() + makePocket(pocket.black);
}

export function makeCastlingFen(board: Board, unmovedRooks: SquareSet, opts?: FenOpts): string {
  const shredder = opts && opts.shredder;
  let fen = '';
  for (const color of COLORS) {
    const king = board.kingOf(color);
    const backrank = SquareSet.fromRank(color == 'white' ? 0 : 7);
    const candidates = board.pieces(color, 'rook').intersect(backrank);
    for (const rook of unmovedRooks.intersect(candidates).reversed()) {
      if (!shredder && rook === candidates.first() && king && rook < king) {
        fen += color == 'white' ? 'Q' : 'q';
      } else if (!shredder && rook === candidates.last() && king && king < rook) {
        fen += color == 'white' ? 'K' : 'k';
      } else {
        fen += (color == 'white' ? 'ABCDEFGH' : 'abcdefgh')[rook & 0x7];
      }
    }
  }
  return fen || '-';
}

export function makeRemainingChecks(checks: RemainingChecks): string {
  return `${checks.white}+${checks.black}`;
}

export function makeFen(setup: Setup, opts?: FenOpts): string {
  return [
    makeBoardFen(setup.board, opts) + (setup.pockets ? `[${makePockets(setup.pockets)}]` : ''),
    setup.turn[0],
    makeCastlingFen(setup.board, setup.unmovedRooks, opts),
    defined(setup.epSquare) ? makeSquare(setup.epSquare) : '-',
    ...(setup.remainingChecks ? [makeRemainingChecks(setup.remainingChecks)] : []),
    ...(opts && opts.epd ? [] : [setup.halfmoves, setup.fullmoves])
  ].join(' ');
}
