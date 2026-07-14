// ── 共有型定義（クライアント / Durable Object 共通） ──────────────

export type Player = { id: string; name: string; color: string };

export const PLAYER_COLOR_PALETTE = [
  "#f87171", "#fb923c", "#facc15", "#4ade80", "#34d399",
  "#22d3ee", "#60a5fa", "#818cf8", "#a78bfa", "#e879f9", "#fb7185",
];

export function pickPlayerColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PLAYER_COLOR_PALETTE[h % PLAYER_COLOR_PALETTE.length];
}

export type CardDef = {
  defId: string;
  text: string;
  imageDataId: string | null;
};

export type Card = {
  id: string;
  kind: "card";
  x: number;
  y: number;
  rotation: number;
  faceDown: boolean;
  text: string;
  imageDataId: string | null;
  defId: string | null;
  chipIds: string[];
  ownArea: { kind: "deck" | "hand"; id: string } | null;
  zOrder: number;
};

export type ChipEffect =
  | { op: "add"; amount: number }
  | { op: "sub"; amount: number }
  | { op: "mul"; amount: number }
  | { op: "div"; amount: number }
  | { op: "none" };

export type ChipDef = {
  defId: string;
  label: string;
  color: string;
  effect: ChipEffect;
};

export type Chip = {
  id: string;
  kind: "chip";
  x: number;
  y: number;
  defId: string;
  label: string;
  color: string;
  effect: ChipEffect;
  zOrder: number;
};

export type Deck = {
  id: string;
  kind: "deck";
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  rotation?: number;
};

export type Hand = {
  id: string;
  kind: "hand";
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  ownerId: string | null;
  rotation?: number;
};

export type Counter = {
  id: string;
  kind: "counter";
  x: number;
  y: number;
  name: string;
  value: number;
  rotation?: number;
};

export type GameObject = Card | Chip | Deck | Hand | Counter;

export type RoomState = {
  ownerId: string | null;
  mode: "edit" | "play";
  players: Player[];
  cardDefs: CardDef[];
  chipDefs: ChipDef[];
  objects: GameObject[];
  imageStore: { [imageDataId: string]: string };
};

export type Action =
  | { kind: "setObjects"; objects: GameObject[] }
  | { kind: "updateObj"; id: string; patch: Partial<GameObject> }
  | { kind: "moveObj"; id: string; x: number; y: number }
  | {
      kind: "moveCard";
      id: string;
      x: number;
      y: number;
      chipMoves: { id: string; x: number; y: number }[];
    }
  | { kind: "moveArea"; id: string; x: number; y: number }
  | { kind: "addObj"; obj: GameObject }
  | { kind: "deleteObj"; id: string }
  | { kind: "setMode"; mode: "edit" | "play" }
  | { kind: "setCardDefs"; cardDefs: CardDef[] }
  | { kind: "setChipDefs"; chipDefs: ChipDef[] }
  | { kind: "setPlayers"; players: Player[] }
  | { kind: "setImage"; imageDataId: string; data: string }
  | { kind: "setImageStore"; imageStore: { [imageDataId: string]: string } };

export type ClientMessage =
  | { type: "join"; playerId: string; playerName: string }
  | { type: "action"; payload: Action }
  | { type: "cursor"; x: number; y: number };

export type ServerMessage =
  | { type: "init"; state: RoomState; selfId: string; connectedIds: string[] }
  | { type: "action"; payload: Action; from: string }
  | { type: "players"; players: Player[]; connectedIds: string[] }
  | { type: "cursor"; playerId: string; x: number; y: number };

export const CHIP_DEFS: ChipDef[] = [
  { defId: "c5", label: "+5", color: "#4ade80", effect: { op: "add", amount: 5 } },
  { defId: "c10", label: "+10", color: "#22c55e", effect: { op: "add", amount: 10 } },
  { defId: "c50", label: "+50", color: "#16a34a", effect: { op: "add", amount: 50 } },
  { defId: "cm5", label: "-5", color: "#f87171", effect: { op: "sub", amount: 5 } },
  { defId: "cm10", label: "-10", color: "#ef4444", effect: { op: "sub", amount: 10 } },
  { defId: "cm50", label: "-50", color: "#dc2626", effect: { op: "sub", amount: 50 } },
  { defId: "c2x", label: "×2", color: "#facc15", effect: { op: "mul", amount: 2 } },
  { defId: "chalf", label: "÷2", color: "#fb923c", effect: { op: "div", amount: 2 } },
  { defId: "cnone", label: "💠", color: "#60a5fa", effect: { op: "none" } },
];

export const EFFECT_LABELS: Record<ChipEffect["op"], string> = {
  add: "数値計算＋",
  sub: "数値計算－",
  mul: "数値計算×",
  div: "数値計算÷",
  none: "効果なし",
};

export function defaultChipLabel(effect: ChipEffect): string {
  switch (effect.op) {
    case "add":
      return `+${effect.amount}`;
    case "sub":
      return `-${effect.amount}`;
    case "mul":
      return `×${effect.amount}`;
    case "div":
      return `÷${effect.amount}`;
    case "none":
      return "―";
  }
}
