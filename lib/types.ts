// ── 共有型定義（クライアント / Durable Object 共通） ──────────────

export type Player = { id: string; name: string };

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

export type Chip = {
  id: string;
  kind: "chip";
  x: number;
  y: number;
  defId: string;
  label: string;
  value: number | "2x" | "half" | "life";
  color: string;
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
};

export type Counter = {
  id: string;
  kind: "counter";
  x: number;
  y: number;
  name: string;
  value: number;
};

export type GameObject = Card | Chip | Deck | Hand | Counter;

export type RoomState = {
  ownerId: string | null;
  mode: "edit" | "play";
  players: Player[];
  cardDefs: CardDef[];
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
  | { kind: "setPlayers"; players: Player[] }
  | { kind: "setImage"; imageDataId: string; data: string }
  | { kind: "setImageStore"; imageStore: { [imageDataId: string]: string } };

export type ClientMessage =
  | { type: "join"; playerId: string; playerName: string }
  | { type: "action"; payload: Action };

export type ServerMessage =
  | { type: "init"; state: RoomState; selfId: string }
  | { type: "action"; payload: Action; from: string }
  | { type: "players"; players: Player[] };

export const CHIP_DEFS = [
  { defId: "c5", label: "+5", value: 5 as number, color: "#4ade80" },
  { defId: "c10", label: "+10", value: 10 as number, color: "#22c55e" },
  { defId: "c50", label: "+50", value: 50 as number, color: "#16a34a" },
  { defId: "cm5", label: "-5", value: -5 as number, color: "#f87171" },
  { defId: "cm10", label: "-10", value: -10 as number, color: "#ef4444" },
  { defId: "cm50", label: "-50", value: -50 as number, color: "#dc2626" },
  { defId: "c2x", label: "×2", value: "2x" as const, color: "#facc15" },
  { defId: "chalf", label: "½", value: "half" as const, color: "#fb923c" },
  { defId: "cdiamond", label: "💠", value: "life" as const, color: "#60a5fa" },
];
