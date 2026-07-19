// ── ゲームロジック（プロトタイプから移植・純粋関数） ──────────────
// クライアント（楽観的反映）と Durable Object（正本の状態更新）の
// 両方から import して使う。DOM に依存しないこと。

import type {
  GameObject,
  Card,
  Chip,
  CardDef,
  Action,
  RoomState,
} from "./types";

let _uid = 1;
export const uid = () => `o${Date.now().toString(36)}${(_uid++).toString(36)}`;

// カードの文字数に応じてフォントサイズを縮小し、長文でも枠内に収まりやすくする
export function autoTextFontSize(text: string, base: number): number {
  const len = (text || "").length;
  if (len <= 16) return base;
  if (len <= 30) return Math.round(base * 0.85 * 10) / 10;
  if (len <= 50) return Math.round(base * 0.7 * 10) / 10;
  if (len <= 80) return Math.round(base * 0.58 * 10) / 10;
  return Math.round(base * 0.48 * 10) / 10;
}
export function calcPower(chips: Chip[]): string {
  let base = 0;
  let multi = 1;
  chips.forEach((c) => {
    const e = c.effect;
    if (!e) return;
    if (e.op === "add") base += e.amount;
    else if (e.op === "sub") base -= e.amount;
    else if (e.op === "mul") multi *= e.amount;
    else if (e.op === "div") multi /= e.amount || 1;
  });
  let t = base * multi;
  t = Math.floor(t / 5) * 5;
  return t >= 0 ? `+${t}` : `${t}`;
}

// チップ中心がカード矩形内か（回転考慮）
export function chipOnCard(chip: Chip, card: Card): boolean {
  const CW = 90,
    CH = 126,
    CR = 19;
  const ccx = card.x + CW / 2,
    ccy = card.y + CH / 2;
  const cx = chip.x + CR,
    cy = chip.y + CR;
  const r = (-card.rotation * Math.PI) / 180;
  const cos = Math.cos(r),
    sin = Math.sin(r);
  const dx = cx - ccx,
    dy = cy - ccy;
  const lx = dx * cos - dy * sin,
    ly = dx * sin + dy * cos;
  return lx >= -CW / 2 && lx <= CW / 2 && ly >= -CH / 2 && ly <= CH / 2;
}

// チップをカード端内にクランプ
export function clampChipToCard(chip: Chip, card: Card): { x: number; y: number } {
  const CW = 90,
    CH = 126,
    CR = 19;
  const ccx = card.x + CW / 2,
    ccy = card.y + CH / 2;
  const cx = chip.x + CR,
    cy = chip.y + CR;
  const r = (-card.rotation * Math.PI) / 180;
  const cos = Math.cos(r),
    sin = Math.sin(r);
  const dx = cx - ccx,
    dy = cy - ccy;
  let lx = dx * cos - dy * sin,
    ly = dx * sin + dy * cos;
  const mx = CW / 2 - CR + 2,
    my = CH / 2 - CR + 2;
  lx = Math.max(-mx, Math.min(mx, lx));
  ly = Math.max(-my, Math.min(my, ly));
  const rr = (card.rotation * Math.PI) / 180;
  const cr2 = Math.cos(rr),
    sr2 = Math.sin(rr);
  return { x: ccx + lx * cr2 - ly * sr2 - CR, y: ccy + lx * sr2 + ly * cr2 - CR };
}

// チップ衝突解決（8イテレーション）
export function resolveChipCollisions(chips: Chip[]): Chip[] {
  const R = 19;
  let arr = chips.map((c) => ({ ...c }));
  for (let iter = 0; iter < 8; iter++) {
    let moved = false;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const ax = arr[i].x + 19,
          ay = arr[i].y + 19;
        const bx = arr[j].x + 19,
          by = arr[j].y + 19;
        const dx = bx - ax,
          dy = by - ay;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < R && dist > 0.01) {
          const push = (R - dist) / 2,
            nx = dx / dist,
            ny = dy / dist;
          arr[i] = { ...arr[i], x: arr[i].x - nx * push, y: arr[i].y - ny * push };
          arr[j] = { ...arr[j], x: arr[j].x + nx * push, y: arr[j].y + ny * push };
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return arr;
}

// ── オブジェクト生成 ─────────────────────────────────────────
export const mkCardDef = (text = "カード", imageDataId: string | null = null): CardDef => ({
  defId: uid(),
  text,
  imageDataId,
});

export const mkCardFromDef = (
  def: { text: string; imageDataId?: string | null; defId?: string },
  x: number,
  y: number,
  zOrder = 0
): Card => ({
  id: uid(),
  kind: "card",
  x,
  y,
  rotation: 0,
  faceDown: false,
  text: def.text,
  imageDataId: def.imageDataId || null,
  defId: def.defId || null,
  chipIds: [],
  ownArea: null,
  zOrder,
});

export const mkDeck = (x: number, y: number) => ({
  id: uid(),
  kind: "deck" as const,
  x,
  y,
  w: 110,
  h: 150,
  rotation: 0,
  name: "山札",
});

export const mkHand = (x: number, y: number) => ({
  id: uid(),
  kind: "hand" as const,
  x,
  y,
  w: 300,
  h: 130,
  rotation: 0,
  name: "手札エリア",
  ownerId: null,
});

export const mkCounter = (x: number, y: number) => ({
  id: uid(),
  kind: "counter" as const,
  x,
  y,
  rotation: 0,
  name: "ライフ",
  value: 20,
});

export const mkChip = (
  x: number,
  y: number,
  def: { defId: string; label: string; color: string; effect: import("./types").ChipEffect },
  zOrder = 0
): Chip => ({ id: uid(), kind: "chip", x, y, defId: def.defId, label: def.label, color: def.color, effect: def.effect, zOrder });

// ── Z優先度（種別間・固定） ────────────────────────────────────
export function kindZ(kind: GameObject["kind"]): number {
  return { chip: 300, card: 200, counter: 100, deck: 10, hand: 10 }[kind] ?? 1;
}

export function nextZ(objs: GameObject[], kind: GameObject["kind"]): number {
  const same = objs.filter((o) => o.kind === kind);
  return same.length === 0 ? 1 : Math.max(...same.map((o) => (o as any).zOrder || 0)) + 1;
}

// 一番奥（最背面）に送るためのZ値。カードの「潜り込み」操作で使用。
export function prevZ(objs: GameObject[], kind: GameObject["kind"]): number {
  const same = objs.filter((o) => o.kind === kind);
  return same.length === 0 ? -1 : Math.min(...same.map((o) => (o as any).zOrder || 0)) - 1;
}

export function deckCards(objs: GameObject[], deckId: string): Card[] {
  return (objs.filter((o) => o.kind === "card" && (o as Card).ownArea?.id === deckId) as Card[]).sort(
    (a, b) => (a.zOrder || 0) - (b.zOrder || 0)
  );
}

export function handCards(objs: GameObject[], handId: string): Card[] {
  return objs.filter((o) => o.kind === "card" && (o as Card).ownArea?.id === handId) as Card[];
}

// カード移動時にチップも追従
export function moveCardWithChips(objs: GameObject[], cardId: string, dx: number, dy: number): GameObject[] {
  const card = objs.find((o) => o.id === cardId) as Card | undefined;
  if (!card) return objs;
  return objs.map((o) => {
    if (o.id === cardId) return { ...o, x: o.x + dx, y: o.y + dy };
    if (o.kind === "chip" && (card.chipIds || []).includes(o.id)) return { ...o, x: o.x + dx, y: o.y + dy };
    return o;
  });
}

// エリア移動時に所属カード（＋チップ）も追従
export function moveAreaWithCards(objs: GameObject[], areaId: string, dx: number, dy: number): GameObject[] {
  return objs.map((o) => {
    if (o.id === areaId) return { ...o, x: o.x + dx, y: o.y + dy };
    if (o.kind === "card" && (o as Card).ownArea?.id === areaId) {
      return { ...o, x: o.x + dx, y: o.y + dy };
    }
    if (o.kind === "chip") {
      const parentCard = objs.find(
        (c) => c.kind === "card" && (c as Card).ownArea?.id === areaId && (c as Card).chipIds.includes(o.id)
      );
      if (parentCard) return { ...o, x: o.x + dx, y: o.y + dy };
    }
    return o;
  });
}

// カードをエリアに入れる。position="bottom" でカード束の一番下に入れる（潜り込み操作用）。
export function addCardToArea(
  objs: GameObject[],
  cardId: string,
  areaId: string,
  areaKind: "deck" | "hand",
  position: "top" | "bottom" = "top"
): GameObject[] {
  const area = objs.find((o) => o.id === areaId) as any;
  if (!area) return objs;
  const areaCards = objs.filter((o) => (o as Card).ownArea?.id === areaId);
  let z: number;
  if (areaCards.length === 0) z = 1;
  else if (position === "top") z = Math.max(...areaCards.map((o) => (o as any).zOrder || 0)) + 1;
  else z = Math.min(...areaCards.map((o) => (o as any).zOrder || 0)) - 1;
  return objs.map((o) => {
    if (o.id !== cardId) return o;
    if (areaKind === "deck") {
      const cx = area.x + area.w / 2 - 45;
      const cy = area.y + area.h / 2 - 63;
      return { ...o, ownArea: { kind: "deck", id: areaId }, x: cx, y: cy, rotation: 0, faceDown: true, zOrder: z };
    } else {
      return { ...o, ownArea: { kind: "hand", id: areaId }, zOrder: z };
    }
  });
}

export function removeCardFromArea(objs: GameObject[], cardId: string): GameObject[] {
  return objs.map((o) => (o.id === cardId ? { ...o, ownArea: null } : o));
}

export function ptInArea(px: number, py: number, area: { x: number; y: number; w: number; h: number }): boolean {
  return px >= area.x && px <= area.x + area.w && py >= area.y && py <= area.y + area.h;
}

// ── Action リデューサ（クライアント楽観反映・DO 正本更新の両方で共有） ──
export function applyAction(state: RoomState, action: Action): RoomState {
  switch (action.kind) {
    case "setObjects":
      return { ...state, objects: action.objects };
    case "updateObj":
      return {
        ...state,
        objects: state.objects.map((o) => (o.id === action.id ? ({ ...o, ...action.patch } as GameObject) : o)),
      };
    case "moveObj":
      return {
        ...state,
        objects: state.objects.map((o) => (o.id === action.id ? { ...o, x: action.x, y: action.y } : o)),
      };
    case "moveCard": {
      let next = state.objects.map((o) => (o.id === action.id ? { ...o, x: action.x, y: action.y } : o));
      const chipMap = new Map(action.chipMoves.map((m) => [m.id, m]));
      next = next.map((o) => {
        const m = chipMap.get(o.id);
        return m ? { ...o, x: m.x, y: m.y } : o;
      });
      return { ...state, objects: next };
    }
    case "moveArea": {
      // moveAreaは「エリア＋所属カード＋チップ」をまとめて移動する（仕様4章参照）。
      // 送られてくるのはエリア自体の絶対座標なので、直前の座標との差分を
      // moveAreaWithCards に渡して所属オブジェクトも追従させる。
      const area = state.objects.find((o) => o.id === action.id);
      if (!area) return state;
      const dx = action.x - area.x;
      const dy = action.y - area.y;
      if (dx === 0 && dy === 0) return state;
      return { ...state, objects: moveAreaWithCards(state.objects, action.id, dx, dy) };
    }
    case "addObj":
      return { ...state, objects: [...state.objects, action.obj] };
    case "deleteObj":
      return { ...state, objects: state.objects.filter((o) => o.id !== action.id) };
    case "setMode":
      return { ...state, mode: action.mode };
    case "setCardDefs":
      return { ...state, cardDefs: action.cardDefs };
    case "setChipDefs":
      return { ...state, chipDefs: action.chipDefs };
    case "setPlayers":
      return { ...state, players: action.players };
    case "setImage":
      return { ...state, imageStore: { ...state.imageStore, [action.imageDataId]: action.data } };
    case "setImageStore":
      return { ...state, imageStore: action.imageStore };
    default:
      return state;
  }
}
