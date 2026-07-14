"use client";

import { useRef, useState } from "react";
import { useHoverDelay } from "@/hooks/useHoverDelay";
import { calcPower, deckCards } from "@/lib/gameLogic";
import type { Card, Chip, Counter, Deck, GameObject, Hand } from "@/lib/types";

type StartDrag = (e: React.MouseEvent, id: string, kind: string, isHandle?: boolean, opts?: any) => void;

// ── オブジェクトレンダラー振り分け ─────────────────────────
export function ObjRender(props: {
  obj: GameObject;
  mode: "edit" | "play";
  myId: string;
  objects: GameObject[];
  imageStore: Record<string, string>;
  startDrag: StartDrag;
  onDblClick: (e: React.MouseEvent, obj: GameObject) => void;
  onCtxMenu: (e: React.MouseEvent, obj: GameObject) => void;
  onChangeCounter: (id: string, delta: number) => void;
  onToggleFace: (id: string) => void;
  flashId: string | null;
  onHoverCard: (id: string | null) => void;
  onFlash: (id: string) => void;
  burrowId: string | null;
}) {
  const { obj } = props;
  if (obj.kind === "card") return <CardObj {...props} obj={obj as Card} isBurrowing={props.burrowId === obj.id} />;
  if (obj.kind === "chip") return <ChipObj obj={obj as Chip} startDrag={props.startDrag} />;
  if (obj.kind === "deck") return <DeckObj {...props} obj={obj as Deck} />;
  if (obj.kind === "hand") return <HandObj {...props} obj={obj as Hand} />;
  if (obj.kind === "counter") return <CounterObj {...props} obj={obj as Counter} />;
  return null;
}

// ── カード ──────────────────────────────────────────────────
export function CardObj({ ... }) {
  // 省略（元のCardObjをそのまま使用）
  // 必要なら元のrawからコピー
}

// ── 山札エリア（回転対応） ──────────────────────────────────────────────
export function DeckObj({
  obj,
  mode,
  objects,
  startDrag,
  onDblClick,
  onCtxMenu,
  flashId,
}: {
  obj: Deck;
  mode: "edit" | "play";
  objects: GameObject[];
  startDrag: StartDrag;
  onDblClick: (e: React.MouseEvent, obj: GameObject) => void;
  onCtxMenu: (e: React.MouseEvent, obj: GameObject) => void;
  flashId: string | null;
}) {
  const { hovered, onEnter, onLeave } = useHoverDelay(300);
  const cards = deckCards(objects, obj.id);
  const rotation = (obj as any).rotation || 0;

  return (
    <div
      style={{ 
        position: "absolute", 
        left: obj.x, 
        top: obj.y, 
        width: obj.w, 
        height: obj.h, 
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center center",
        zIndex: hovered ? 12 : 10, 
        pointerEvents: "auto" 
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div style={{ position: "absolute", top: -22, left: 0, fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
        {obj.name}（{cards.length}枚）
      </div>
      <div
        onMouseDown={(e) => startDrag(e, obj.id, "deck")}
        onDoubleClick={(e) => onDblClick(e, obj)}
        onContextMenu={(e) => onCtxMenu(e, obj)}
        style={{
          width: "100%",
          height: "100%",
          border: `2px dashed ${flashId === obj.id ? "#fbbf24" : hovered ? "#60a5fa" : "#374151"}`,
          boxShadow: flashId === obj.id ? "0 0 18px rgba(251,191,36,0.5)" : "none",
          borderRadius: 8,
          cursor: "grab",
          background: "rgba(13,17,23,0.53)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#374151",
          fontSize: 32,
        }}
      >
        📚
      </div>
      {/* 回転ハンドル */}
      {mode === "edit" && hovered && (
        <div
          style={{
            position: "absolute",
            top: -14,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1d4ed8",
            color: "#e2e8f0",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 10,
            cursor: "crosshair",
            zIndex: 50,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            startDrag(e, obj.id, "deck", true);
          }}
        >
          ↻
        </div>
      )}
      {/* リサイズハンドルはそのまま */}
    </div>
  );
}

// HandObj, CounterObj も同様に rotation 対応を追加（省略）
export function HandObj({ obj, ...props }) {
  const rotation = (obj as any).rotation || 0;
  // 既存のHandObjに transform と transformOrigin を追加
  // ... 
}

export function CounterObj({ obj, ...props }) {
  const rotation = (obj as any).rotation || 0;
  // 同様に transform 追加
}
