import { z } from "zod";
//  zod schema
export const PhaseSchema = z.union([z.literal('placementP1'), z.literal('placementP2'), z.literal('battle')]);
export const OrientationSchema = z.union([z.literal('H'), z.literal('V')]);
export const CoordSchema = z.object({ x: z.number().int().min(0).max(6), y: z.number().int().min(0).max(6) });
export const PieceKeySchema = z.union([z.literal('1x1'), z.literal('2x2'), z.literal('2x1'), z.literal('3x1')]);
export const PlacementASchema = z.object({ piece: PieceKeySchema, x: z.number().int().min(0).max(6), y: z.number().int().min(0).max(6), o: OrientationSchema.optional() });
export const PlacementSpecSchema = z.object({ placements: z.array(PlacementASchema) });
export const PieceDefSchema = z.object({ key: PieceKeySchema, w: z.number(), h: z.number(), count: z.number(), label: z.string() });
export const PlacedPieceSchema = z.object({ id: z.string(), key: PieceKeySchema, w: z.number(), h: z.number(), origin: CoordSchema, cells: z.array(z.string()), hits: z.array(z.string()) });
export const BoardStateSchema = z.object({ size: z.number(), pieces: z.array(PlacedPieceSchema), attacks: z.record(z.union([z.literal('hit'), z.literal('miss')])) });
export const PlayerStateSchema = z.object({ name: z.string(), board: BoardStateSchema, inventory: z.record(z.number()) });
export const PlayerSchema = z.union([z.literal(1), z.literal(2)]);

export const MotionSchema = z.object({
  posX: z.number().int().min(0).max(6),
  posY: z.number().int().min(0).max(6),
  hit: z.boolean(),
  aiWin: z.boolean(),
});
export type Motion = z.infer<typeof MotionSchema>;
// export interface Motion {
//   posX: number,
//   posY: number,
//   hit: boolean,
//   aiWin: boolean,
// }

export const placement1Schema = z.object({
  phase: PhaseSchema,
  orientation: OrientationSchema,
  selectedPieceKey: z.nullable(PieceKeySchema),
  placementHistory: z.array(PlacedPieceSchema),
  currentPlayer: PlayerSchema,
  p1: PlayerStateSchema,
  p2: PlayerStateSchema,
  motion: z.undefined(MotionSchema)
})

// ====== 型 ======
export type Phase = z.infer<typeof PhaseSchema>;
export type Orientation = z.infer<typeof OrientationSchema>;
export type Coord = z.infer<typeof CoordSchema>
export type PieceDef = z.infer<typeof PieceDefSchema>
export type PlacedPiece = z.infer<typeof PlacedPieceSchema>
export type BoardState = z.infer<typeof BoardStateSchema>
export type PlayerState = z.infer<typeof PlayerStateSchema>

// ---- AI出力(JSON)の形(A方式) ----
export type PieceKey  = z.infer<typeof PieceKeySchema>

export type PlacementA  = z.infer<typeof PlacementASchema>
//   {
//   piece: PieceKey;
//   x: number;     // 0..6
//   y: number;     // 0..6
//   o?: Orientation; // 'H'|'V' (1x1/2x2は省略可)
// };

export type PlacementSpec = z.infer<typeof PlacementSpecSchema>
//   = {
//   placements: PlacementA[];
// };

// 検証結果
export type ValidateResult =
  | { ok: true; value: { placements: PlacementA[] } }
  | { ok: false; errors: string[] };

// JSONシリアライズ用の型
// const SerializableBoardStateSchema = z.lazy(() => BoardStateSchema.omit({ attacks: true }));
// export interface SerializableBoardState {
//   size: number;
//   pieces: {
//     id: string;
//     key: string;
//     w: number;
//     h: number;
//     origin: Coord;
//     cells: string[];
//     hits: string[];
//   }[];
//   attacks: { pos: string; result: 'hit' | 'miss' }[];
// }

export interface SerializablePlayerState {
  name: string;
  board: BoardState;
  // board: SerializableBoardState;
  inventory: Record<string, number>;
}

// export interface GameSnapshot {
//   phase: Phase;
//   currentPlayer: 1 | 2;
//   orientation: Orientation;
//   selectedPieceKey: string | null;
//   p1: SerializablePlayerState;
//   p2: SerializablePlayerState;
// }

export type State = {
  board: GameSnapshot;
  gameSession: string;
  currentSeq: number;
};


export interface GameSnapshot{
  phase: Phase;
  orientation: Orientation;
  selectedPieceKey: string|null;
  placementHistory: PlacedPiece[];
  currentPlayer: 1|2;
  p1: SerializablePlayerState;
  p2: SerializablePlayerState;
  motion?: Motion
}

// ====== 定数 ======
export const SIZE = 7;
export const PIECES: PieceDef[] = [
  { key: '1x1', w: 1, h: 1, count: 2, label: '1×1 ×2' },
  { key: '2x2', w: 2, h: 2, count: 1, label: '2×2 ×1' },
  { key: '2x1', w: 2, h: 1, count: 2, label: '2×1 ×2' },
  { key: '3x1', w: 3, h: 1, count: 1, label: '3×1 ×1' },
];

export const keyOf = (c: Coord) => `${c.x},${c.y}`;
export const parseKey = (k: string): Coord => { const [x,y] = k.split(',').map(Number); return {x,y}; };
export const inBounds = (x:number, y:number) => x>=0 && y>=0 && x<SIZE && y<SIZE;
export const makeEmptyBoard = (): BoardState => ({ size: SIZE, pieces: [], attacks: {} });
export const cloneInventory = () => Object.fromEntries(PIECES.map(p=>[p.key,p.count])) as Record<string,number>;

