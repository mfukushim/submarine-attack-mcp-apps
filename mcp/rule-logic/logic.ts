import {
  type BoardState, cloneInventory,
  type Coord, type GameSnapshot,
  inBounds,
  keyOf, makeEmptyBoard,
  type Orientation,
  parseKey, type PieceKey, PIECES,
  type PlacedPiece, type PlacementA,
  type PlayerState,
  type SerializablePlayerState, SIZE, type ValidateResult
} from "../../Def";
import {gameRule} from "./gameRule";
import {placeRule} from "./placeRule";

// ====== 状態 ======
export const p1: PlayerState = { name: 'Player1', board: makeEmptyBoard(), inventory: cloneInventory() };
export const p2: PlayerState = { name: 'Player2', board: makeEmptyBoard(), inventory: cloneInventory() };
// export let phase: Phase = 'placementP1';
//export let currentPlayer: 1|2 = 1;
// export let orientationG: Orientation = 'H';
// export let selectedPieceKey: string|null = '1x1';
// export let placementHistory: PlacedPiece[] = [];


export const currentPlacer = () => gameState.phase==='placementP1' ? p1 : p2;
export const currentOpponent = () => gameState.currentPlayer===1 ? p2 : p1;
export const currentAttacker = () => gameState.currentPlayer===1 ? p1 : p2;

export const INIT_PATTERN = JSON.stringify({
  phase: 'placementP1',
  orientation: 'H',
  selectedPieceKey: '1x1',
  placementHistory: [],
  currentPlayer: 1,
  p1: p1,
  p2: p2,
  // p1: playerToJSON(p1),
  // p2: playerToJSON(p2),
  seq: 0,
});
//  埋め込みhtmlに現在のプレイ状態を受け渡すためのマジック文字列
//  @ts-ignore
const initialState:string = INIT_PATTERN

export const gameState:GameSnapshot ={
  phase: 'placementP1',
  orientation: 'H',
  selectedPieceKey: '1x1',
  placementHistory: [],
  currentPlayer: 1,
  p1: p1,
  p2: p2,
  // p1: playerToJSON(p1),
  // p2: playerToJSON(p2),
  seq: 0,
}

if(initialState) {
  applyGameFromJSON(JSON.parse(initialState))
}



console.log('INIT_PATTERN',INIT_PATTERN)
console.log('gameState',gameState)



export function expandCells(w:number, h:number, origin:Coord, o:Orientation): string[] {
  const W = o==='H'? w : h;
  const H = o==='H'? h : w;
  const cells: string[] = [];
  for (let yy=0; yy<H; yy++) for (let xx=0; xx<W; xx++) {
    const x = origin.x + xx;
    const y = origin.y + yy;
    cells.push(keyOf({x,y}));
  }
  return cells;
}


export function canPlace(board: BoardState, w:number, h:number, origin:Coord, o:Orientation) {
  const cells = expandCells(w,h,origin,o);
  for (const k of cells) { const {x,y} = parseKey(k); if (!inBounds(x,y)) return false; }
  for (const piece of board.pieces) for (const k of piece.cells) if (cells.includes(k)) return false;
  return true;
}


export function placePiece(board: BoardState, key:"1x1" | "2x2" | "2x1" | "3x1", w:number, h:number, origin:Coord, o:Orientation): PlacedPiece {
  const id = `${key}#${Math.random().toString(16).slice(2)}`;
  const cells = expandCells(w,h,origin,o);
  const piece: PlacedPiece = { id, key, w: o==='H'?w:h, h: o==='H'?h:w, origin, cells, hits:[] };
  board.pieces.push(piece);
  return piece;
}

// ====== ランダム配置ユーティリティ ======

// 現在のプレイヤーの盤面を、ルールに従ってランダムに全コマ配置する
export function randomFillForPlayer(p: PlayerState) {
  // いったん盤面とインベントリをリセット
  p.board = makeEmptyBoard();
  p.inventory = cloneInventory();

  const board = p.board;

  // 何度かリトライして、どうしてもダメなら諦める
  let attempts = 0;
  const maxAttempts = 5000;

  // 配置順は PIECES のままでOK（難しければ大きいものからでもよい）
  for (const def of PIECES) {
    for (let c = 0; c < def.count; c++) {
      let placed = false;
      while (!placed) {
        if (attempts++ > maxAttempts) {
          // 一旦失敗したら、再帰的に最初からやり直す
          console.warn('randomFillForPlayer: retry all placement');
          return randomFillForPlayer(p);
        }

        const orientation: Orientation = Math.random() < 0.5 ? 'H' : 'V';
        const x = Math.floor(Math.random() * SIZE);
        const y = Math.floor(Math.random() * SIZE);
        const origin: Coord = { x, y };

        if (canPlace(board, def.w, def.h, origin, orientation)) {
          placePiece(board, def.key, def.w, def.h, origin, orientation);
          p.inventory[def.key] -= 1;
          placed = true;
        }
      }
    }
  }
}

export function setToBattle() {
  gameState.phase='battle';
  gameState.currentPlayer=1;
}

export function allSunk(board: BoardState) { return board.pieces.every(p => p.cells.every(c => p.hits.includes(c))); }


export function receiveAttack(board: BoardState, at: Coord): 'hit' | 'miss' | 'repeat' {
  const k = keyOf(at);

  // すでに攻撃済みなら何もしない
  if (board.attacks[k]) return 'repeat';

  // 命中チェック
  for (const piece of board.pieces) {
    if (piece.cells.includes(k)) {
      // ★1マスだけ命中★
      piece.hits.push(k);
      board.attacks[k] = 'hit';
      return 'hit';
    }
  }

  // 外れ
  board.attacks[k] = 'miss';
  return 'miss';
}

function boardToJSON(board: BoardState): BoardState {
  return {
    size: board.size,
    pieces: board.pieces.map(p => ({
      id: p.id,
      key: p.key,
      w: p.w,
      h: p.h,
      origin: p.origin,
      cells: [...p.cells],
      hits: [...p.hits],
    })),
    attacks: {...board.attacks},
  };
}

function boardFromJSON(data: BoardState): BoardState {
  const b: BoardState = {
    size: data.size,
    pieces: [],
    attacks: {},
  };

  for (const p of data.pieces) {
    b.pieces.push({
      id: p.id,
      key: p.key,
      w: p.w,
      h: p.h,
      origin: p.origin,
      cells: [...p.cells],
      hits: [...p.hits],
    });
  }

  b.attacks = {...data.attacks};
  // for (const a of data.attacks) {
  //   b.attacks.set(a.pos, a.result);
  // }

  return b;
}

export function playerToJSON(p: PlayerState): SerializablePlayerState {
  return {
    name: p.name,
    board: boardToJSON(p.board),
    inventory: { ...p.inventory },
  };
}

function applyPlayerFromJSON(target: PlayerState, data: SerializablePlayerState) {
  target.name = data.name;
  target.board = boardFromJSON(data.board);
  target.inventory = { ...data.inventory };
}

// export function gameToJSON(): GameSnapshot {
//   return {
//     phase: gameState.phase,
//     currentPlayer: gameState.currentPlayer,
//     orientation: gameState.orientation,
//     selectedPieceKey:gameState.selectedPieceKey,
//     placementHistory: [...gameState.placementHistory],
//     p1: playerToJSON(p1),
//     p2: playerToJSON(p2),
//   };
// }

export function applyGameFromJSON(snap: GameSnapshot) {
  gameState.phase = snap.phase;
  gameState.currentPlayer = snap.currentPlayer;
  gameState.orientation = snap.orientation;
  gameState.selectedPieceKey = snap.selectedPieceKey;

  applyPlayerFromJSON(p1, snap.p1);
  applyPlayerFromJSON(p2, snap.p2);

  // ★注意：配置のundo履歴は復元しない（必要なら別途シリアライズ）
  // gameState.placementHistory = [];
  gameState.placementHistory = snap.placementHistory;

  gameState.motion = snap.motion
  gameState.seq = snap.seq
  // setPhaseUI(gameState.phase);
  // renderAll();
}

// ====== AI 用テキスト表現 ======

function buildSelfBoardString(p: PlayerState): string[] {
  // 真の自分の盤面（自分から見たもの）:
  // '.' = 空, 'S' = 船(未命中), 'X' = 船(命中), 'o' = 空への外れ
  const grid: string[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => '.')
  );

  // 空への外れ
  for (const [k, res] of Object.entries(p.board.attacks)) {
    if (res === 'miss') {
      const { x, y } = parseKey(k);
      grid[y][x] = 'o';
    }
  }

  // 船 + 被弾
  for (const piece of p.board.pieces) {
    for (const cellKey of piece.cells) {
      const { x, y } = parseKey(cellKey);
      if (piece.hits.includes(cellKey)) {
        grid[y][x] = 'X';
      } else {
        // まだ当たっていない船
        if (grid[y][x] !== 'X') {
          grid[y][x] = 'S';
        }
      }
    }
  }

  return grid.map((row) => row.join(''));
}

function buildOpponentKnowledgeString(_: PlayerState, defender: PlayerState): string[] {
  // 相手盤面について自分が「知っている範囲」:
  // '.' = 未攻撃, 'X' = 命中, 'o' = 外れ
  const grid: string[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => '.')
  );

  for (const [k, res] of Object.entries(defender.board.attacks)) {
    // defender.board.attacks は defender が被弾した履歴
    // ＝ attacker が撃った履歴
    const { x, y } = parseKey(k);
    grid[y][x] = res === 'hit' ? 'X' : 'o';
  }

  return grid.map((row) => row.join(''));
}

function countHitsOn(defender: PlayerState): number {
  let count = 0;
  for (const [, res] of Object.entries(defender.board.attacks)) {
    if (res === 'hit') count++;
  }
  return count;
}

function countShotsOn(defender: PlayerState): number {
  return Object.entries(defender.board.attacks).length;
}

// 現在の手番プレイヤー視点のテキストを生成
export function buildAiDescriptionForCurrentPlayer(): string {
  const me = currentAttacker();
  const opp = currentOpponent();

  const selfBoardLines = buildSelfBoardString(me);
  const oppKnowledgeLines = buildOpponentKnowledgeString(me, opp);

  const totalShots = countShotsOn(opp);
  const totalHits = countHitsOn(opp);

  const lines: string[] = [];

  lines.push('SubmarineGameState');
  lines.push(`phase: ${gameState.phase}`);
  lines.push(`current_player: ${gameState.currentPlayer}`);
  lines.push('');

  lines.push(`[PLAYER ${gameState.currentPlayer} PERSPECTIVE]`);
  lines.push('');

  lines.push('SELF_BOARD_TRUE (7x7, y=0..6 top to bottom, x=0..6 left to right)');
  lines.push("legend: '.'=empty, 'S'=ship, 'X'=hit ship, 'o'=miss");
  selfBoardLines.forEach((row, y) => {
    lines.push(`row${y}: ${row}`);
  });
  lines.push('');

  lines.push('OPPONENT_BOARD_KNOWLEDGE (7x7, y=0..6 top to bottom, x=0..6 left to right)');
  lines.push("legend: '.'=unknown, 'X'=hit, 'o'=miss");
  oppKnowledgeLines.forEach((row, y) => {
    lines.push(`row${y}: ${row}`);
  });
  lines.push('');

  lines.push(`total_shots_fired_by_self: ${totalShots}`);
  lines.push(`total_hits_on_opponent: ${totalHits}`);

  return lines.join('\n');
}


//  拡張ロジック

// あとでAIと合わせる 現在の手番プレイヤー視点のテキストを生成
export function buildAiDescriptionForAiPlayer(): string {
  const me = p2;
  const opp = p1;

  const selfBoardLines = buildSelfBoardString(me);
  const oppKnowledgeLines = buildOpponentKnowledgeString(me, opp);

  const totalShots = countShotsOn(opp);
  const totalHits = countHitsOn(opp);

  const lines: string[] = [];

  lines.push('SubmarineGameState');
  lines.push(`phase: ${gameState.phase}`);
  lines.push(`current_player: ${gameState.currentPlayer}`);
  lines.push('');

  lines.push(`[PLAYER ${gameState.currentPlayer} PERSPECTIVE]`);
  lines.push('');

  lines.push('SELF_BOARD_TRUE (7x7, y=0..6 top to bottom, x=0..6 left to right)');
  lines.push("legend: '.'=empty, 'S'=ship, 'X'=hit ship, 'o'=miss");
  selfBoardLines.forEach((row, y) => {
    lines.push(`row${y}: ${row}`);
  });
  lines.push('');

  lines.push('OPPONENT_BOARD_KNOWLEDGE (7x7, y=0..6 top to bottom, x=0..6 left to right)');
  lines.push("legend: '.'=unknown, 'X'=hit, 'o'=miss");
  oppKnowledgeLines.forEach((row, y) => {
    lines.push(`row${y}: ${row}`);
  });
  lines.push('');

  lines.push(`total_shots_fired_by_self: ${totalShots}`);
  lines.push(`total_hits_on_opponent: ${totalHits}`);

  return lines.join('\n');
}

export function getGameRule() {
  return gameRule as string;
}

export function getPlaceRule() {
  return placeRule as string;
}


// ------------------------------
// 1) AIの配置JSONを検証する
// ------------------------------
export function validatePlacementSpec(placements: PlacementA[]): ValidateResult {
  const errors: string[] = [];

  // 受け取ったものが文字列なら JSON.parse を試す
  // let obj: any = input;
  // if (typeof input === 'string') {
  //   try {
  //     obj = JSON.parse(input);
  //   } catch {
  //     return { ok: false, errors: ['Invalid JSON: parse failed'] };
  //   }
  // }
  //
  // if (!obj || typeof obj !== 'object') {
  //   return { ok: false, errors: ['Invalid payload: must be an object'] };
  // }
  //
  // if (!Array.isArray(obj.placements)) {
  //   return { ok: false, errors: ['Invalid payload: "placements" must be an array'] };
  // }
  //
  // const placements: PlacementA[] = obj.placements;

  if (placements.length !== 6) {
    errors.push(`Invalid placements length: expected 6, got ${placements.length}`);
  }

  // 個数ルール
  const requiredCount: Record<PieceKey, number> = {
    '1x1': 2,
    '2x2': 1,
    '2x1': 2,
    '3x1': 1,
  };

  const count: Record<PieceKey, number> = { '1x1': 0, '2x2': 0, '2x1': 0, '3x1': 0 };

  // 盤外/重なり判定のために占有セルを計算
  const occupied = new Set<string>();

  const pieceDefMap = new Map<string, { w: number; h: number }>();
  for (const def of PIECES) pieceDefMap.set(def.key, { w: def.w, h: def.h });

  const isInt = (n: any) => Number.isInteger(n);
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  const cellKey = (x: number, y: number) => `${x},${y}`;

  const expandCells = (piece: PieceKey, x: number, y: number, o: Orientation): string[] => {
    // 既存 PIECES 定義に従う (2x1/3x1/2x2/1x1)
    const def = pieceDefMap.get(piece);
    if (!def) return [];
    const baseW = def.w;
    const baseH = def.h;

    // アンカーは常に「左上」
    const W = o === 'H' ? baseW : baseH;
    const H = o === 'H' ? baseH : baseW;

    const cells: string[] = [];
    for (let yy = 0; yy < H; yy++) {
      for (let xx = 0; xx < W; xx++) {
        cells.push(cellKey(x + xx, y + yy));
      }
    }
    return cells;
  };

  // placements を走査
  placements.forEach((p, i) => {
    const path = `placements[${i}]`;

    if (!p || typeof p !== 'object') {
      errors.push(`${path}: must be an object`);
      return;
    }

    // piece
    const piece = p.piece as PieceKey;
    if (piece !== '1x1' && piece !== '2x2' && piece !== '2x1' && piece !== '3x1') {
      errors.push(`${path}.piece: invalid "${String(p.piece)}"`);
      return;
    }
    count[piece]++;

    // x,y
    if (!isInt(p.x)) errors.push(`${path}.x: must be an integer`);
    if (!isInt(p.y)) errors.push(`${path}.y: must be an integer`);

    const x = Number(p.x);
    const y = Number(p.y);

    // orientation (必要なものだけ必須)
    const needsO = piece === '2x1' || piece === '3x1';
    const o: Orientation | undefined = p.o;

    if (needsO) {
      if (o !== 'H' && o !== 'V') {
        errors.push(`${path}.o: required and must be "H" or "V" for piece ${piece}`);
        return;
      }
    } else {
      // 1x1 / 2x2 は o があっても許可（ただし値は妥当で）
      if (o !== undefined && o !== 'H' && o !== 'V') {
        errors.push(`${path}.o: if present must be "H" or "V"`);
        return;
      }
    }

    const orientation: Orientation = (needsO ? (o as Orientation) : (o ?? 'H')) as Orientation;

    // セル展開
    const cells = expandCells(piece, x, y, orientation);
    if (cells.length === 0) {
      errors.push(`${path}: unknown piece def "${piece}"`);
      return;
    }

    // 盤外チェック
    for (const ck of cells) {
      const [cx, cy] = ck.split(',').map(Number);
      if (!inBounds(cx, cy)) {
        errors.push(`${path}: out of bounds at cell (${cx},${cy})`);
      }
    }

    // 重なりチェック
    for (const ck of cells) {
      if (occupied.has(ck)) {
        const [cx, cy] = ck.split(',').map(Number);
        errors.push(`${path}: overlap at cell (${cx},${cy})`);
      }
    }
    // occupied に追加（盤外でも一旦入れると重なり検出が安定）
    for (const ck of cells) occupied.add(ck);
  });

  // 個数チェック
  (Object.keys(requiredCount) as PieceKey[]).forEach((k) => {
    if (count[k] !== requiredCount[k]) {
      errors.push(`Piece count mismatch for ${k}: expected ${requiredCount[k]}, got ${count[k]}`);
    }
  });

  if (errors.length) return { ok: false, errors };

  // 正規化（1x1/2x2 の o は落としても良いが、ここではそのまま返す）
  return { ok: true, value: { placements } };
}

// ------------------------------
// 2) 検証済み配置を PlayerState に適用する
//    （盤面とインベントリをリセットして配置）
// ------------------------------
export function applyPlacementsToPlayer(player: PlayerState, placements: PlacementA[]) {
  // リセット
  player.board = makeEmptyBoard();
  player.inventory = cloneInventory();

  // PIECES 定義から w/h を引く
  const defMap = new Map<string, { w: number; h: number }>();
  for (const d of PIECES) defMap.set(d.key, { w: d.w, h: d.h });

  for (const p of placements) {
    const def = defMap.get(p.piece);
    if (!def) throw new Error(`Unknown piece def: ${p.piece}`);

    const needsO = p.piece === '2x1' || p.piece === '3x1';
    const o: Orientation = needsO ? (p.o as Orientation) : ((p.o ?? 'H') as Orientation);

    const origin = { x: p.x, y: p.y };

    // 念のため再チェック（validate通過していれば基本OK）
    if (!canPlace(player.board, def.w, def.h, origin, o)) {
      throw new Error(`applyPlacementsToPlayer: cannot place ${p.piece} at (${p.x},${p.y}) o=${o}`);
    }

    placePiece(player.board, p.piece, def.w, def.h, origin, o);

    // inventory 減算（validateで個数は合っている想定）
    if ((player.inventory[p.piece] ?? 0) <= 0) {
      throw new Error(`applyPlacementsToPlayer: inventory underflow for ${p.piece}`);
    }
    player.inventory[p.piece] -= 1;
  }
}

export function isPlacementEnd(p:PlayerState) {
  return Object.values(p.inventory).reduce((previousValue, currentValue) => previousValue+currentValue) === 0;
}

// ------------------------------
// 3) AIに再生成させて「通るまで」回すループ
//    ※ 実際のLLM呼び出しは外に置く想定。
//       この関数は「候補を返すコールバック」を受け取る。
// ------------------------------
// export type PlacementCandidateProvider = (args: {
//   // 初回は null、再試行では前回のエラー理由を渡す
//   previousErrors: string[] | null;
// }) => Promise<unknown>; // string(JSON)でもobjectでもOK

// export async function getValidPlacementsWithRetries(options: {
//   provider: PlacementCandidateProvider;
//   maxRetries?: number; // default 5
// }): Promise<{ placements: PlacementA[] }> {
//   const maxRetries = options.maxRetries ?? 5;
//   let prevErrors: string[] | null = null;
//
//   for (let attempt = 1; attempt <= maxRetries; attempt++) {
//     const candidate = await options.provider({ previousErrors: prevErrors });
//
//     const vr = validatePlacementSpec(candidate);
//     if (vr.ok) {
//       return { placements: vr.value.placements };
//     }
//
//     // 次の試行へ：エラー理由をそのままAIに返せる
//     prevErrors = vr.errors;
//   }
//
//   throw new Error(
//     `Failed to obtain a valid placement after ${maxRetries} retries. Last errors:\n- ${prevErrors?.join(
//       '\n- '
//     )}`
//   );
// }
