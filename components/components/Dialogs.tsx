"use client";

import { useEffect, useRef, useState } from "react";
import type { CardDef, ChipDef, ChipEffect, GameObject, Player } from "@/lib/types";
import { EFFECT_LABELS, defaultChipLabel } from "@/lib/types";

export const tb = (active = false): React.CSSProperties => ({
  background: active ? "#21262d" : "transparent",
  border: "1px solid #30363d",
  borderRadius: 6,
  padding: "4px 12px",
  color: active ? "#e2e8f0" : "#8b949e",
  cursor: "pointer",
  fontSize: 12,
  transition: "background 0.12s",
});

// ── プレイヤーダイアログ ────────────────────────────────────
export function PlayerDlg({
  players,
  myId,
  connectedIds,
  onSelectMe,
  onUpdateName,
  onUpdateColor,
  onAddPlayer,
  onDeletePlayer,
  onClose,
}: {
  players: Player[];
  myId: string;
  connectedIds: string[];
  onSelectMe: (id: string) => void;
  onUpdateName: (id: string, name: string) => void;
  onUpdateColor: (id: string, color: string) => void;
  onAddPlayer: () => void;
  onDeletePlayer: (id: string) => void;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const isConnected = (id: string) => connectedIds.includes(id) && id !== myId;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, padding: 28, minWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.8)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#e2e8f0" }}>👥 プレイヤー確認</div>
        <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 20 }}>
          自分のプレイヤーを選択してください（🟢=接続中は選択不可）
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {players.map((pl) => {
            const connectedByOther = isConnected(pl.id);
            const isMe = myId === pl.id;
            const selectable = !connectedByOther && !isMe;
            return (
              <div
                key={pl.id}
                onClick={() => selectable && onSelectMe(pl.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: isMe ? "#1e3a5f" : "#21262d",
                  border: `1px solid ${isMe ? "#3b82f6" : "#30363d"}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: selectable ? "pointer" : "default",
                  opacity: connectedByOther ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: pl.color || "#374151",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    flexShrink: 0,
                    border: "2px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {isMe ? "✓" : ""}
                </div>

                {isMe && editingId === pl.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => {
                      onUpdateName(pl.id, editName || pl.name);
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onUpdateName(pl.id, editName || pl.name);
                        setEditingId(null);
                      }
                    }}
                    style={{ flex: 1, background: "#0d1117", border: "1px solid #3b82f6", borderRadius: 4, padding: "2px 8px", color: "#e2e8f0", fontSize: 13 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>{pl.name}</span>
                )}

                <span style={{ fontSize: 11, flexShrink: 0 }} title={connectedByOther || isMe ? "接続中" : "未接続"}>
                  {connectedByOther || isMe ? "🟢" : "⚪"}
                </span>

                {isMe && (
                  <>
                    <input
                      type="color"
                      value={pl.color || "#4ade80"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdateColor(pl.id, e.target.value)}
                      style={{ width: 26, height: 26, border: "1px solid #30363d", borderRadius: 4, background: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                      title="自分の色"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(pl.id);
                        setEditName(pl.name);
                      }}
                      style={{ background: "transparent", border: "1px solid #374151", borderRadius: 4, padding: "2px 8px", color: "#8b949e", cursor: "pointer", fontSize: 11, flexShrink: 0 }}
                    >
                      編集
                    </button>
                  </>
                )}

                {!isMe && !connectedByOther && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePlayer(pl.id);
                    }}
                    style={{ background: "transparent", border: "1px solid #7f1d1d", borderRadius: 4, padding: "2px 8px", color: "#f87171", cursor: "pointer", fontSize: 11, flexShrink: 0 }}
                    title="このプレイヤーを削除"
                  >
                    削除
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <button onClick={onAddPlayer} style={tb()}>
            ＋ プレイヤー追加
          </button>
          <button onClick={onClose} style={{ ...tb(), background: "#1d4ed8", color: "#e2e8f0", borderColor: "#1d4ed8" }}>
            決定
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 右クリックメニュー（盤面オブジェクト） ─────────────────
export function CtxMenu({
  menu,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  menu: { x: number; y: number; obj: GameObject };
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: (() => void) | null;
}) {
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener("click", h, { once: true });
    return () => window.removeEventListener("click", h);
  }, [onClose]);

  const items: { l: string; a: () => void }[] = [];
  if (["card", "deck", "counter"].includes(menu.obj.kind)) items.push({ l: "✏️ 編集", a: onEdit });
  if (onDuplicate) items.push({ l: "📋 複製", a: onDuplicate });
  items.push({ l: "🗑️ 削除", a: onDelete });

  return (
    <div style={{ position: "fixed", left: menu.x, top: menu.y, zIndex: 2000, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, boxShadow: "0 4px 18px rgba(0,0,0,0.56)", overflow: "hidden", minWidth: 130 }}>
      {items.map((it, i) => (
        <div
          key={i}
          onClick={it.a}
          style={{ padding: "9px 16px", fontSize: 13, cursor: "pointer", color: "#e2e8f0" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#21262d")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
        >
          {it.l}
        </div>
      ))}
    </div>
  );
}

// ── 右クリックメニュー（サイドバーのカード定義） ───────────
export function SbCtxMenu({
  menu,
  onClose,
  onEdit,
  onDelete,
}: {
  menu: { x: number; y: number; def: CardDef | ChipDef };
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener("click", h, { once: true });
    return () => window.removeEventListener("click", h);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", left: menu.x, top: menu.y, zIndex: 2000, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, boxShadow: "0 4px 18px rgba(0,0,0,0.56)", overflow: "hidden", minWidth: 130 }}>
      {[{ l: "✏️ 編集", a: onEdit }, { l: "🗑️ 削除", a: onDelete }].map((it, i) => (
        <div
          key={i}
          onClick={it.a}
          style={{ padding: "9px 16px", fontSize: 13, cursor: "pointer", color: "#e2e8f0" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#21262d")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
        >
          {it.l}
        </div>
      ))}
    </div>
  );
}

// ── 編集ダイアログ（カード内容 / エリア名 等） ─────────────
export function EditDlg({
  target,
  onClose,
  onSave,
}: {
  target: GameObject;
  onClose: () => void;
  onSave: (patch: Record<string, any>) => void;
}) {
  const isCard = target.kind === "card";
  const [text, setText] = useState(isCard ? (target as any).text : (target as any).name);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 24, minWidth: 300 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#8b949e" }}>{isCard ? "カード内容" : "名前"}を編集</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: "100%", minHeight: 80, background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: 8, color: "#e2e8f0", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={tb()}>
            キャンセル
          </button>
          <button onClick={() => onSave(isCard ? { text } : { name: text })} style={{ ...tb(), background: "#1d4ed8", color: "#e2e8f0", borderColor: "#1d4ed8" }}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ── カード定義ダイアログ（画像ファイル選択・一括追加対応） ───
export function CardDefDlg({
  mode,
  def,
  imageStore,
  storeImage,
  onClose,
  onSave,
  onSaveBulk,
  newImageDataId,
}: {
  mode: "new" | "edit";
  def?: CardDef;
  imageStore: Record<string, string>;
  storeImage: (id: string, base64: string) => void;
  onClose: () => void;
  onSave: (patch: { text: string; imageDataId: string | null }) => void;
  onSaveBulk: (defs: { text: string; imageDataId: string | null }[]) => void;
  newImageDataId: string;
}) {
  const [bulkMode, setBulkMode] = useState(false);
  const [inputType, setInputType] = useState<"text" | "image">(def?.imageDataId ? "image" : "text");
  const [text, setText] = useState(def?.text || "");
  const [previewUrl, setPreviewUrl] = useState(def?.imageDataId ? imageStore[def.imageDataId] || "" : "");
  const imageDataId = def?.imageDataId || def?.defId || newImageDataId;
  const fileRef = useRef<HTMLInputElement>(null);

  // 一括追加用：画像は複数選択、テキストは改行区切り
  const [bulkText, setBulkText] = useState("");
  const [bulkLabel, setBulkLabel] = useState("");
  const [bulkImages, setBulkImages] = useState<{ id: string; url: string }[]>([]);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setPreviewUrl(b64);
      storeImage(imageDataId, b64);
    };
    reader.readAsDataURL(file);
  };

  const onBulkFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const b64 = ev.target?.result as string;
        const id = `img_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        storeImage(id, b64);
        setBulkImages((prev) => [...prev, { id, url: b64 }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const save = () => {
    if (bulkMode) {
      if (inputType === "text") {
        const lines = bulkText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
        onSaveBulk(lines.map((line) => ({ text: line, imageDataId: null })));
      } else {
        onSaveBulk(bulkImages.map((img) => ({ text: bulkLabel, imageDataId: img.id })));
      }
      return;
    }
    if (inputType === "text") onSave({ text, imageDataId: null });
    else onSave({ text, imageDataId: previewUrl ? imageDataId : null });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, padding: 28, minWidth: 340, maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.8)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{mode === "new" ? "カードを新規作成" : "カードを編集"}</div>
          {mode === "new" && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8b949e", cursor: "pointer" }}>
              <input type="checkbox" checked={bulkMode} onChange={(e) => setBulkMode(e.target.checked)} />
              一括追加
            </label>
          )}
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 16, border: "1px solid #30363d", borderRadius: 6, overflow: "hidden" }}>
          <button
            onClick={() => setInputType("text")}
            style={{ flex: 1, background: inputType === "text" ? "#1d4ed8" : "transparent", border: "none", padding: "7px 0", color: inputType === "text" ? "#e2e8f0" : "#8b949e", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
          >
            テキスト
          </button>
          <button
            onClick={() => setInputType("image")}
            style={{ flex: 1, background: inputType === "image" ? "#1d4ed8" : "transparent", border: "none", padding: "7px 0", color: inputType === "image" ? "#e2e8f0" : "#8b949e", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
          >
            画像
          </button>
        </div>

        {!bulkMode && (
          <>
            <div style={{ marginBottom: 8, fontSize: 11, color: "#8b949e" }}>カード名・テキスト</div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="カード名やテキストを入力"
              style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
            />
            {inputType === "image" && (
              <div>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ width: "100%", background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "8px 0", color: "#94a3b8", cursor: "pointer", fontSize: 12, marginBottom: 10 }}
                >
                  📁 画像ファイルを選択
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
                {previewUrl && <img src={previewUrl} alt="" style={{ width: "100%", maxHeight: 120, objectFit: "contain", borderRadius: 6, marginBottom: 10, border: "1px solid #30363d" }} />}
              </div>
            )}
          </>
        )}

        {bulkMode && inputType === "text" && (
          <div>
            <div style={{ marginBottom: 8, fontSize: 11, color: "#8b949e" }}>1行につき1枚のカードとして作成されます</div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"カードA\nカードB\nカードC"}
              style={{ width: "100%", minHeight: 130, background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: 8, color: "#e2e8f0", fontSize: 13, resize: "vertical", boxSizing: "border-box", marginBottom: 8 }}
            />
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {bulkText.split("\n").map((l) => l.trim()).filter((l) => l).length} 枚作成されます
            </div>
          </div>
        )}

        {bulkMode && inputType === "image" && (
          <div>
            <div style={{ marginBottom: 8, fontSize: 11, color: "#8b949e" }}>共通テキスト（任意）</div>
            <input
              value={bulkLabel}
              onChange={(e) => setBulkLabel(e.target.value)}
              placeholder="全カード共通のテキスト（空欄可）"
              style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
            />
            <button
              onClick={() => bulkFileRef.current?.click()}
              style={{ width: "100%", background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "8px 0", color: "#94a3b8", cursor: "pointer", fontSize: 12, marginBottom: 10 }}
            >
              📁 画像ファイルを複数選択
            </button>
            <input ref={bulkFileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onBulkFilesChange} />
            {bulkImages.length > 0 && (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {bulkImages.map((img) => (
                    <img key={img.id} src={img.url} alt="" style={{ width: 44, height: 60, objectFit: "cover", borderRadius: 4, border: "1px solid #30363d" }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{bulkImages.length} 枚作成されます</div>
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={tb()}>
            キャンセル
          </button>
          <button onClick={save} style={{ ...tb(), background: "#1d4ed8", color: "#e2e8f0", borderColor: "#1d4ed8" }}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ── チップ定義ダイアログ（色はカラーピッカー、効果は種別＋数値で指定） ──
export function ChipDefDlg({
  def,
  onClose,
  onSave,
}: {
  def?: ChipDef;
  onClose: () => void;
  onSave: (patch: { label: string; color: string; effect: ChipEffect }) => void;
}) {
  const [op, setOp] = useState<ChipEffect["op"]>(def?.effect.op || "add");
  const [amount, setAmount] = useState<number>(def?.effect && "amount" in def.effect ? def.effect.amount : 5);
  const [color, setColor] = useState(def?.color || "#4ade80");
  const [label, setLabel] = useState(def?.label ?? "");
  const [labelTouched, setLabelTouched] = useState(!!def);

  const effect: ChipEffect = op === "none" ? { op: "none" } : { op, amount };
  const autoLabel = defaultChipLabel(effect);
  const effectiveLabel = labelTouched && label ? label : autoLabel;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, padding: 28, minWidth: 320, maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.8)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#e2e8f0" }}>{def ? "チップを編集" : "チップを新規作成"}</div>

        <div style={{ marginBottom: 8, fontSize: 11, color: "#8b949e" }}>効果</div>
        <select
          value={op}
          onChange={(e) => setOp(e.target.value as ChipEffect["op"])}
          style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
        >
          {(Object.keys(EFFECT_LABELS) as ChipEffect["op"][]).map((k) => (
            <option key={k} value={k}>
              {EFFECT_LABELS[k]}
            </option>
          ))}
        </select>

        {op !== "none" && (
          <>
            <div style={{ marginBottom: 8, fontSize: 11, color: "#8b949e" }}>数値</div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
            />
          </>
        )}

        <div style={{ marginBottom: 8, fontSize: 11, color: "#8b949e" }}>表示ラベル（空欄で自動: {autoLabel}）</div>
        <input
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setLabelTouched(true);
          }}
          placeholder={autoLabel}
          style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
        />

        <div style={{ marginBottom: 8, fontSize: 11, color: "#8b949e" }}>色</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 32, border: "1px solid #30363d", borderRadius: 6, background: "none", cursor: "pointer", padding: 0 }} />
          <div
            style={{ width: 40, height: 40, borderRadius: "50%", background: color, border: "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
          >
            {effectiveLabel}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={tb()}>
            キャンセル
          </button>
          <button
            onClick={() => onSave({ label: effectiveLabel, color, effect })}
            style={{ ...tb(), background: "#1d4ed8", color: "#e2e8f0", borderColor: "#1d4ed8" }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
