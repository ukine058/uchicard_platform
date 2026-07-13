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
}) {
  const { obj } = props;
  if (obj.kind === "card") return <CardObj {...props} obj={obj as Card} />;
  if (obj.kind === "chip") return <ChipObj obj={obj as Chip} startDrag={props.startDrag} />;
  if (obj.kind === "deck") return <DeckObj {...props} obj={obj as Deck} />;
  if (obj.kind === "hand") return <HandObj {...props} obj={obj as Hand} />;
  if (obj.kind === "counter") return <CounterObj {...props} obj={obj as Counter} />;
  return null;
}

// ── カード ──────────────────────────────────────────────────
export function CardObj({
  obj,
  mode,
  myId,
  objects,
  imageStore,
  startDrag,
  onDblClick,
  onCtxMenu,
  flashId,
  onHoverCard,
  onFlash,
  onToggleFace,
}: {
  obj: Card;
  mode: "edit" | "play";
  myId: string;
  objects: GameObject[];
  imageStore: Record<string, string>;
  startDrag: StartDrag;
  onDblClick: (e: React.MouseEvent, obj: GameObject) => void;
  onCtxMenu: (e: React.MouseEvent, obj: GameObject) => void;
  flashId: string | null;
  onHoverCard: (id: string | null) => void;
  onFlash: (id: string) => void;
  onToggleFace: (id: string) => void;
}) {
  const W = 90,
    H = 126;
  const chips = objects.filter((o) => o.kind === "chip" && (obj.chipIds || []).includes(o.id)) as Chip[];
  const power = chips.length > 0 ? calcPower(chips) : null;
  const { hovered, onEnter, onLeave } = useHoverDelay(300);
  const isFlashing = flashId === obj.id;

  const isInDeck = obj.ownArea?.kind === "deck";
  const isDraggable =
    !isInDeck ||
    (() => {
      const dc = deckCards(objects, obj.ownArea!.id);
      return dc.length > 0 && dc[dc.length - 1].id === obj.id;
    })();

  const isInHand = obj.ownArea?.kind === "hand";
  const hand = isInHand ? (objects.find((o) => o.id === obj.ownArea!.id) as Hand | undefined) : null;
  const isMyHand = hand?.ownerId === myId;
  const showFace = !obj.faceDown || (isInHand && isMyHand);

  return (
    <div
      style={{
        position: "absolute",
        left: obj.x,
        top: obj.y,
        width: W,
        height: H + 28,
        transform: `rotate(${obj.rotation}deg)`,
        transformOrigin: `${W / 2}px ${H / 2}px`,
        zIndex: 200 + (obj.zOrder || 0),
        pointerEvents: "auto",
      }}
      onMouseEnter={() => {
        onEnter();
        onHoverCard(obj.id);
      }}
      onMouseLeave={() => {
        onLeave();
        onHoverCard(null);
      }}
    >
      {/* 上端：回転ハンドル */}
      <div
        style={{
          position: "absolute",
          top: -14,
          left: 4,
          right: 4,
          height: 12,
          background: hovered ? "#1d4ed8" : "transparent",
          border: hovered ? "2px solid #60a5fa" : "2px solid transparent",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          color: hovered ? "#e2e8f0" : "transparent",
          cursor: "crosshair",
          transition: "all 0.15s",
          zIndex: 60,
          pointerEvents: "auto",
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          startDrag(e, obj.id, "card", true);
        }}
      >
        ↻ 回転
      </div>

      {/* カード本体 */}
      <div
        onMouseDown={(e) => (isDraggable ? startDrag(e, obj.id, "card") : e.stopPropagation())}
        onDoubleClick={(e) => onDblClick(e, obj)}
        onContextMenu={(e) => onCtxMenu(e, obj)}
        style={{
          width: W,
          height: H,
          background: showFace ? "linear-gradient(160deg,#1e2d3d,#111827)" : "linear-gradient(135deg,#1c2e4a,#0d1b2e)",
          border: `2px solid ${isFlashing ? "#fbbf24" : hovered ? "#60a5fa" : isDraggable ? "#374151" : "#1e3a5f"}`,
          borderRadius: 8,
          cursor: isDraggable ? "grab" : "not-allowed",
          boxShadow: isFlashing
            ? "0 0 18px rgba(251,191,36,0.7)"
            : hovered
            ? "0 0 14px rgba(96,165,250,0.33)"
            : "0 3px 10px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: showFace ? 12 : 32,
          color: showFace ? "#e2e8f0" : "#1e3a5f",
          textAlign: "center",
          padding: 6,
          overflow: "hidden",
          transition: "border-color 0.12s,box-shadow 0.12s",
          position: "relative",
        }}
      >
        {showFace ? (
          imageStore[obj.imageDataId || obj.defId || ""] ? (
            <img
              src={imageStore[obj.imageDataId || obj.defId || ""]}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }}
            />
          ) : (
            obj.text
          )
        ) : (
          "🂠"
        )}
        {hovered && (
          <div
            style={{
              position: "absolute",
              bottom: 2,
              left: 4,
              right: 4,
              height: 16,
              background: "rgba(0,0,0,0.7)",
              border: "1px solid #475569",
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              color: "#94a3b8",
              cursor: "pointer",
              zIndex: 61,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onToggleFace(obj.id);
            }}
          >
            {obj.faceDown ? "▲ 表にする" : "▼ 裏にする"}
          </div>
        )}
      </div>

      {power && (
        <div
          style={{
            position: "absolute",
            top: H + 2,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0d1117",
            border: "1px solid #374151",
            borderRadius: 4,
            padding: "1px 7px",
            fontSize: 11,
            fontWeight: 700,
            color: power.startsWith("+") ? "#4ade80" : "#f87171",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {power}
        </div>
      )}

      {isInDeck && isDraggable && (
        <div
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            background: "rgba(0,0,0,0.7)",
            border: "1px solid #475569",
            borderRadius: 3,
            padding: "1px 5px",
            fontSize: 9,
            color: "#94a3b8",
            pointerEvents: "none",
          }}
        >
          TOP
        </div>
      )}
    </div>
  );
}

// ── チップ ──────────────────────────────────────────────────
export function ChipObj({ obj, startDrag }: { obj: Chip; startDrag: StartDrag }) {
  return (
    <div
      onMouseDown={(e) => startDrag(e, obj.id, "chip")}
      style={{
        position: "absolute",
        left: obj.x,
        top: obj.y,
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: obj.color,
        border: "2px solid rgba(255,255,255,0.2)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.44)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        color: "#fff",
        cursor: "grab",
        zIndex: 300 + (obj.zOrder || 0),
        pointerEvents: "auto",
        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
      }}
    >
      {obj.label}
    </div>
  );
}

const RESIZE_HANDLES = [
  { dd: "nw", sxFromW: false, syFromH: false },
  { dd: "ne", sxFromW: true, syFromH: false },
  { dd: "sw", sxFromW: false, syFromH: true },
  { dd: "se", sxFromW: true, syFromH: true },
] as const;

// ── 山札エリア ──────────────────────────────────────────────
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
  return (
    <div
      style={{ position: "absolute", left: obj.x, top: obj.y, width: obj.w, height: obj.h, zIndex: hovered ? 12 : 10, pointerEvents: "auto" }}
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
      {mode === "edit" &&
        hovered &&
        RESIZE_HANDLES.map((h) => (
          <div
            key={h.dd}
            onMouseDown={(e) => {
              e.stopPropagation();
              startDrag(e, obj.id, "deck", true, { dd: h.dd });
            }}
            style={{
              position: "absolute",
              left: h.sxFromW ? obj.w - 10 : -10,
              top: h.syFromH ? obj.h - 10 : -10,
              width: 20,
              height: 20,
              background: "#1e3a5f",
              border: "2px solid #3b82f6",
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "#93c5fd",
              cursor: "nwse-resize",
              zIndex: 40,
              pointerEvents: "auto",
            }}
          >
            ⇲
          </div>
        ))}
    </div>
  );
}

// ── 手札エリア ──────────────────────────────────────────────
export function HandObj({
  obj,
  mode,
  myId,
  objects,
  startDrag,
  onDblClick,
}: {
  obj: Hand;
  mode: "edit" | "play";
  myId: string;
  objects: GameObject[];
  startDrag: StartDrag;
  onDblClick: (e: React.MouseEvent, obj: GameObject) => void;
}) {
  const { hovered, onEnter, onLeave } = useHoverDelay(300);
  const cards = objects.filter((o) => o.kind === "card" && (o as Card).ownArea?.id === obj.id);
  const isOwner = obj.ownerId === myId;
  return (
    <div
      style={{ position: "absolute", left: obj.x, top: obj.y, width: obj.w, height: obj.h, zIndex: hovered ? 12 : 10, pointerEvents: "auto" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div style={{ position: "absolute", top: -22, left: 0, fontSize: 11, color: "#a78bfa", whiteSpace: "nowrap" }}>
        {obj.ownerId ? `${obj.name}（所有者あり）` : "手札エリア（ダブルクリックで所有）"}（{cards.length}枚）
        {obj.ownerId && (
          <span style={{ marginLeft: 6, fontSize: 10, color: isOwner ? "#86efac" : "#f87171" }}>
            {isOwner ? "[自分]" : "[他人]"}
          </span>
        )}
      </div>
      <div
        onMouseDown={(e) => mode === "edit" && startDrag(e, obj.id, "hand")}
        onDoubleClick={(e) => onDblClick(e, obj)}
        style={{
          width: "100%",
          height: "100%",
          border: `2px dashed ${hovered ? "#a78bfa" : "#4c1d95"}`,
          borderRadius: 8,
          cursor: mode === "edit" ? "grab" : "default",
          background: isOwner ? "rgba(26,5,51,0.4)" : "rgba(26,5,51,0.13)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#4c1d95",
          fontSize: 28,
        }}
      >
        {isOwner ? "🤚" : "🔒"}
      </div>
      {mode === "edit" &&
        hovered &&
        RESIZE_HANDLES.map((h) => (
          <div
            key={h.dd}
            onMouseDown={(e) => {
              e.stopPropagation();
              startDrag(e, obj.id, "hand", true, { dd: h.dd });
            }}
            style={{
              position: "absolute",
              left: h.sxFromW ? obj.w - 10 : -10,
              top: h.syFromH ? obj.h - 10 : -10,
              width: 20,
              height: 20,
              background: "#2e1065",
              border: "2px solid #a78bfa",
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "#c4b5fd",
              cursor: "nwse-resize",
              zIndex: 40,
              pointerEvents: "auto",
            }}
          >
            ⇲
          </div>
        ))}
    </div>
  );
}

// ── 得点カウンター ──────────────────────────────────────────
export function CounterObj({
  obj,
  startDrag,
  onCtxMenu,
  onChangeCounter,
}: {
  obj: Counter;
  startDrag: StartDrag;
  onCtxMenu: (e: React.MouseEvent, obj: GameObject) => void;
  onChangeCounter: (id: string, delta: number) => void;
}) {
  const [floatDelta, setFloatDelta] = useState<number | null>(null);
  const floatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const change = (d: number) => {
    onChangeCounter(obj.id, d);
    setFloatDelta((p) => {
      const n = (p || 0) + d;
      if (floatTimer.current) clearTimeout(floatTimer.current);
      floatTimer.current = setTimeout(() => setFloatDelta(null), 1200);
      return n;
    });
  };

  return (
    <div
      onMouseDown={(e) => startDrag(e, obj.id, "counter")}
      onContextMenu={(e) => onCtxMenu(e, obj)}
      style={{
        position: "absolute",
        left: obj.x,
        top: obj.y,
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 10,
        padding: "10px 14px",
        cursor: "grab",
        minWidth: 90,
        zIndex: 100,
        textAlign: "center",
        boxShadow: "0 3px 10px rgba(0,0,0,0.5)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 3 }}>{obj.name}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>{obj.value}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "center" }}>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => change(-1)}
          style={{ background: "#7f1d1d", border: "none", borderRadius: 4, padding: "3px 10px", color: "#fca5a5", cursor: "pointer", fontSize: 15, fontWeight: 700 }}
        >
          −
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => change(1)}
          style={{ background: "#14532d", border: "none", borderRadius: 4, padding: "3px 10px", color: "#86efac", cursor: "pointer", fontSize: 15, fontWeight: 700 }}
        >
          ＋
        </button>
      </div>
      {floatDelta != null && (
        <div
          style={{
            position: "absolute",
            top: -28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0d1117",
            border: "1px solid #30363d",
            borderRadius: 6,
            padding: "2px 10px",
            fontSize: 13,
            fontWeight: 700,
            color: floatDelta >= 0 ? "#4ade80" : "#f87171",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {floatDelta >= 0 ? `+${floatDelta}` : floatDelta}
        </div>
      )}
    </div>
  );
}
