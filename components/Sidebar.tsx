"use client";

import type { CardDef, ChipDef } from "@/lib/types";
import { CHIP_DEFS } from "@/lib/types";

export function Sidebar({
  sidebarRef,
  sidebarTab,
  setSidebarTab,
  cardDefs,
  chipDefs,
  imageStore,
  onNewCardDef,
  onDragStartCardDef,
  onDblClickCardDef,
  onCtxMenuCardDef,
  onNewChipDef,
  onDragStartChip,
  onDblClickChipDef,
  onCtxMenuChipDef,
  onDragStartOther,
}: {
  sidebarRef: React.RefObject<HTMLDivElement>;
  sidebarTab: "card" | "chip" | "other";
  setSidebarTab: (t: "card" | "chip" | "other") => void;
  cardDefs: CardDef[];
  chipDefs: ChipDef[];
  imageStore: Record<string, string>;
  onNewCardDef: () => void;
  onDragStartCardDef: (e: React.DragEvent, def: CardDef) => void;
  onDblClickCardDef: (e: React.MouseEvent, def: CardDef) => void;
  onCtxMenuCardDef: (e: React.MouseEvent, def: CardDef) => void;
  onNewChipDef: () => void;
  onDragStartChip: (e: React.DragEvent, def: ChipDef) => void;
  onDblClickChipDef: (e: React.MouseEvent, def: ChipDef) => void;
  onCtxMenuChipDef: (e: React.MouseEvent, def: ChipDef) => void;
  onDragStartOther: (e: React.DragEvent, type: "deck" | "hand" | "counter") => void;
}) {
  return (
    <div
      ref={sidebarRef}
      style={{ width: 210, background: "#161b22", borderRight: "1px solid #30363d", display: "flex", flexDirection: "column", zIndex: 200, flexShrink: 0 }}
      onDragOver={(e) => e.preventDefault()}
    >
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #30363d", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#8b949e" }}>OBJECTS</div>
      <div style={{ display: "flex", borderBottom: "1px solid #30363d" }}>
        {([["card", "カード"], ["chip", "チップ"], ["other", "その他"]] as const).map(([t, l]) => (
          <button
            key={t}
            onClick={() => setSidebarTab(t)}
            style={{ flex: 1, padding: "7px 0", background: sidebarTab === t ? "#21262d" : "transparent", border: "none", color: sidebarTab === t ? "#e2e8f0" : "#8b949e", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
          >
            {l}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
        {sidebarTab === "card" && (
          <div>
            <button
              onClick={onNewCardDef}
              style={{ width: "100%", background: "#1d4ed8", border: "none", borderRadius: 6, padding: "7px 0", color: "#e2e8f0", cursor: "pointer", fontSize: 12, fontWeight: 600, marginBottom: 10 }}
            >
              ＋ 新規カード作成
            </button>
            {cardDefs.map((def) => (
              <div
                key={def.defId}
                draggable
                onDragStart={(e) => onDragStartCardDef(e, def)}
                onDoubleClick={(e) => onDblClickCardDef(e, def)}
                onContextMenu={(e) => onCtxMenuCardDef(e, def)}
                style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "7px 10px", fontSize: 12, color: "#e2e8f0", cursor: "grab", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}
              >
                <div style={{ width: 28, height: 40, background: "#1e293b", border: "1px solid #374151", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, overflow: "hidden" }}>
                  {imageStore[def.imageDataId || def.defId] ? (
                    <img src={imageStore[def.imageDataId || def.defId]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ color: "#94a3b8", textAlign: "center", wordBreak: "break-all", lineHeight: 1.2 }}>{def.text}</span>
                  )}
                </div>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: "#94a3b8", fontSize: 11 }}>{def.text || "(画像)"}</span>
              </div>
            ))}
            {cardDefs.length === 0 && <div style={{ color: "#374151", fontSize: 11, textAlign: "center", paddingTop: 20 }}>カードがありません</div>}
          </div>
        )}
        {sidebarTab === "chip" && (
          <div>
            <button
              onClick={onNewChipDef}
              style={{ width: "100%", background: "#1d4ed8", border: "none", borderRadius: 6, padding: "7px 0", color: "#e2e8f0", cursor: "pointer", fontSize: 12, fontWeight: 600, marginBottom: 10 }}
            >
              ＋ 新規チップ作成
            </button>
            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>標準チップ</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {CHIP_DEFS.map((cd) => (
                <div
                  key={cd.defId}
                  draggable
                  title={cd.label}
                  onDragStart={(e) => onDragStartChip(e, cd)}
                  style={{ width: 42, height: 42, borderRadius: "50%", background: cd.color, border: "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "grab", textShadow: "0 1px 2px rgba(0,0,0,0.6)", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }}
                >
                  {cd.label}
                </div>
              ))}
            </div>
            {chipDefs.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>カスタムチップ（ダブルクリックで編集）</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {chipDefs.map((cd) => (
                    <div
                      key={cd.defId}
                      draggable
                      title={cd.label}
                      onDragStart={(e) => onDragStartChip(e, cd)}
                      onDoubleClick={(e) => onDblClickChipDef(e, cd)}
                      onContextMenu={(e) => onCtxMenuChipDef(e, cd)}
                      style={{ width: 42, height: 42, borderRadius: "50%", background: cd.color, border: "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "grab", textShadow: "0 1px 2px rgba(0,0,0,0.6)", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }}
                    >
                      {cd.label}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {sidebarTab === "other" &&
          ([["deck", "📚 山札エリア"], ["hand", "🤚 手札エリア"], ["counter", "🔢 得点カウンター"]] as const).map(([t, l]) => (
            <div
              key={t}
              draggable
              onDragStart={(e) => onDragStartOther(e, t)}
              style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#8b949e", cursor: "grab", marginBottom: 6 }}
            >
              {l}
            </div>
          ))}
      </div>
    </div>
  );
}
