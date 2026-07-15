"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import {
  addCardToArea,
  chipOnCard,
  clampChipToCard,
  mkCardFromDef,
  mkChip,
  mkCounter,
  mkDeck,
  mkHand,
  nextZ,
  prevZ,
  ptInArea,
  removeCardFromArea,
  resolveChipCollisions,
  moveCardWithChips,
  moveAreaWithCards,
} from "@/lib/gameLogic";
import { saveRoomZip, loadRoomZip } from "@/lib/zip";
import type { Action, Card, CardDef, Chip, ChipDef, Deck, GameObject, Hand } from "@/lib/types";
import { pickPlayerColor } from "@/lib/types";
import { Sidebar } from "./Sidebar";
import { ObjRender } from "./objects";
import { PlayerDlg, CtxMenu, SbCtxMenu, EditDlg, CardDefDlg, ChipDefDlg, tb } from "./Dialogs";

function kindZOf(kind: GameObject["kind"]) {
  return { chip: 300, card: 200, counter: 100, deck: 10, hand: 10 }[kind] ?? 1;
}

export default function Board({ roomId }: { roomId: string }) {
  const {
    connected,
    room,
    myId,
    myName,
    setMyName,
    setMyColor,
    assumeIdentity,
    connectedIds,
    cursors,
    sendCursor,
    dispatch,
    applyLocal,
    send,
  } = useRoomSocket(roomId);
  const { objects, cardDefs, chipDefs, imageStore, players, mode, ownerId } = room;
  const isOwner = ownerId === myId;

  const [sidebar, setSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"card" | "chip" | "other">("card");
  const [camRot, setCamRot] = useState(0);
  const [camOffset, setCamOffset] = useState({ x: 0, y: 0 });
  const [camZoom, setCamZoom] = useState(1);
  const [showPlayerDlg, setShowPlayerDlg] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; obj: GameObject } | null>(null);
  const [sbCtxMenu, setSbCtxMenu] = useState<{ x: number; y: number; kind: "card" | "chip"; def: CardDef | ChipDef } | null>(null);
  const [cardDefDlg, setCardDefDlg] = useState<{ mode: "new" | "edit"; def?: CardDef } | null>(null);
  const [chipDefDlg, setChipDefDlg] = useState<{ def?: ChipDef } | null>(null);
  const [editTarget, setEditTarget] = useState<GameObject | null>(null);
  const [hoverCardId, setHoverCardId] = useState<string | null>(null);
  const [draggingFromSidebar, setDraggingFromSidebar] = useState<
    | { type: "cardDef"; data: CardDef }
    | { type: "chip"; data: ChipDef }
    | { type: "deck" | "hand" | "counter"; data: Record<string, never> }
    | null
  >(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [burrowId, setBurrowId] = useState<string | null>(null);
  const suppressCtxMenuRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const flash = useCallback((id: string) => {
    setFlashId(id);
    setTimeout(() => setFlashId(null), 400);
  }, []);

  const boardRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; kind: string; isHandle: boolean; dd?: string; burrow?: boolean; rotate?: boolean } | null>(null);
  const rotDrag = useRef<{ startAngle: number; startMouseAngle: number } | null>(null);
  const panDrag = useRef<{ active: boolean } | null>(null);
  const camRotRef = useRef(camRot);
  const camOffRef = useRef(camOffset);
  const camZoomRef = useRef(camZoom);
  const objRef = useRef<GameObject[]>(objects);

  useEffect(() => {
    camRotRef.current = camRot;
  }, [camRot]);
  useEffect(() => {
    camOffRef.current = camOffset;
  }, [camOffset]);
  useEffect(() => {
    camZoomRef.current = camZoom;
  }, [camZoom]);
  useEffect(() => {
    objRef.current = objects;
  }, [objects]);

  // ── 送信スロットル（1フレームに1回だけサーバーへ送る） ──────
  const pendingActionRef = useRef<Action | null>(null);
  const rafScheduledRef = useRef(false);
  const scheduleSend = useCallback(
    (action: Action) => {
      pendingActionRef.current = action;
      if (!rafScheduledRef.current) {
        rafScheduledRef.current = true;
        requestAnimationFrame(() => {
          rafScheduledRef.current = false;
          if (pendingActionRef.current) send(pendingActionRef.current);
          pendingActionRef.current = null;
        });
      }
    },
    [send]
  );

  // ローカル反映 + 描画同期。以後のフレームでの差分計算のため objRef も即時更新する。
  const applyObjectsLocally = useCallback((next: GameObject[]) => {
    objRef.current = next;
    applyLocal({ kind: "setObjects", objects: next });
  }, [applyLocal]);

  // スクリーン→ボード座標
  const s2b = useCallback((sx: number, sy: number) => {
    const rect = boardRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2,
      cy = rect.top + rect.height / 2;
    const dx = sx - cx,
      dy = sy - cy;
    const r = (-camRotRef.current * Math.PI) / 180;
    const cos = Math.cos(r),
      sin = Math.sin(r);
    const rx = (dx * cos - dy * sin) / camZoomRef.current,
      ry = (dx * sin + dy * cos) / camZoomRef.current;
    return { bx: cx - rect.left + rx - camOffRef.current.x, by: cy - rect.top + ry - camOffRef.current.y };
  }, []);

  const isOverSidebar = useCallback((cx: number, cy: number) => {
    if (!sidebarRef.current) return false;
    const r = sidebarRef.current.getBoundingClientRect();
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }, []);

  // マウスホイール（トラックパッドのピンチ操作含む）でカメラのズームを行う。
  // React の onWheel はデフォルトで passive のため preventDefault が効かず、
  // ネイティブの addEventListener で { passive: false } を指定する。
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      setCamZoom((z) => Math.min(3, Math.max(0.3, z * factor)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── グローバルマウスイベント ───────────────────────────────
  useEffect(() => {
    const d2b = (mdx: number, mdy: number) => {
      const r = (camRotRef.current * Math.PI) / 180;
      const cos = Math.cos(r),
        sin = Math.sin(r);
      return { dx: (mdx * cos - mdy * sin) / camZoomRef.current, dy: (mdx * sin + mdy * cos) / camZoomRef.current };
    };

    const onMove = (e: MouseEvent) => {
      if (panDrag.current?.active && !drag.current) {
        const r = (camRotRef.current * Math.PI) / 180;
        const cos = Math.cos(r),
          sin = Math.sin(r);
        const z = camZoomRef.current;
        setCamOffset((p) => ({
          x: p.x + (e.movementX * cos + e.movementY * sin) / z,
          y: p.y + (-e.movementX * sin + e.movementY * cos) / z,
        }));
        return;
      }
      if (rotDrag.current) {
        const rect = boardRef.current!.getBoundingClientRect();
        const cx = rect.left + rect.width / 2,
          cy = rect.top + rect.height / 2;
        const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
        setCamRot(rotDrag.current.startAngle + angle - rotDrag.current.startMouseAngle);
        return;
      }
      if (!drag.current) return;
      const { id, kind, isHandle, dd, burrow } = drag.current;

      // 回転ハンドル（カード・山札・カウンター共通）
      if (isHandle && drag.current.rotate) {
        const { bx, by } = s2b(e.clientX, e.clientY);
        const target = objRef.current.find((o) => o.id === id);
        if (!target) return;
        let centerX: number, centerY: number;
        if (kind === "card") {
          centerX = target.x + 45;
          centerY = target.y + 63;
        } else if (kind === "deck" || kind === "hand") {
          const a = target as Deck | Hand;
          centerX = a.x + a.w / 2;
          centerY = a.y + a.h / 2;
        } else {
          // カウンターは固定サイズの目安中心を使う（内容に応じた自動サイズのため）
          centerX = target.x + 50;
          centerY = target.y + 55;
        }
        const angle = (Math.atan2(by - centerY, bx - centerX) * 180) / Math.PI + 90;
        const next = objRef.current.map((o) => (o.id === id ? { ...o, rotation: angle } : o));
        applyObjectsLocally(next);
        scheduleSend({ kind: "updateObj", id, patch: { rotation: angle } });
        return;
      }

      // エリア拡縮ハンドル
      if (isHandle && (kind === "deck" || kind === "hand") && dd) {
        const { dx, dy } = d2b(e.movementX, e.movementY);
        const area = objRef.current.find((o) => o.id === id) as Deck | Hand | undefined;
        if (!area) return;
        let nw = area.w,
          nh = area.h,
          nx = area.x,
          ny = area.y;
        if (dd.includes("e")) nw = Math.max(80, area.w + dx);
        if (dd.includes("s")) nh = Math.max(60, area.h + dy);
        if (dd.includes("w")) {
          nw = Math.max(80, area.w - dx);
          nx = area.x + dx;
        }
        if (dd.includes("n")) {
          nh = Math.max(60, area.h - dy);
          ny = area.y + dy;
        }
        const next = objRef.current.map((o) => {
          if (o.id === id) return { ...o, w: nw, h: nh, x: nx, y: ny };
          if (kind === "deck" && o.kind === "card" && (o as Card).ownArea?.id === id) {
            return { ...o, x: nx + nw / 2 - 45, y: ny + nh / 2 - 63 };
          }
          return o;
        });
        applyObjectsLocally(next);
        scheduleSend({ kind: "setObjects", objects: next });
        return;
      }

      // 通常移動
      const { dx, dy } = d2b(e.movementX, e.movementY);
      if (kind === "card" && burrow) {
        // 潜り込みドラッグ中: チップは追従させず、カード本体のみ移動
        suppressCtxMenuRef.current = true;
        const next = objRef.current.map((o) => (o.id === id ? { ...o, x: o.x + dx, y: o.y + dy } : o));
        applyObjectsLocally(next);
        const c2 = next.find((o) => o.id === id)!;
        scheduleSend({ kind: "moveObj", id, x: c2.x, y: c2.y });
      } else if (kind === "card") {
        const next = moveCardWithChips(objRef.current, id, dx, dy);
        applyObjectsLocally(next);
        const card = next.find((o) => o.id === id) as Card;
        const chipMoves = next
          .filter((o) => o.kind === "chip" && (card.chipIds || []).includes(o.id))
          .map((c) => ({ id: c.id, x: c.x, y: c.y }));
        scheduleSend({ kind: "moveCard", id, x: card.x, y: card.y, chipMoves });
      } else if (kind === "deck" || kind === "hand") {
        const next = moveAreaWithCards(objRef.current, id, dx, dy);
        applyObjectsLocally(next);
        const area = next.find((o) => o.id === id)!;
        scheduleSend({ kind: "moveArea", id, x: area.x, y: area.y });
      } else {
        const next = objRef.current.map((o) => (o.id === id ? { ...o, x: o.x + dx, y: o.y + dy } : o));
        applyObjectsLocally(next);
        const o2 = next.find((o) => o.id === id)!;
        scheduleSend({ kind: "moveObj", id, x: o2.x, y: o2.y });
      }
    };

    const onUp = (e: MouseEvent) => {
      const d = drag.current;
      if (d && !d.isHandle) {
        if (isOverSidebar(e.clientX, e.clientY)) {
          const next = objRef.current.filter((o) => o.id !== d.id);
          applyObjectsLocally(next);
          dispatch({ kind: "deleteObj", id: d.id });
        } else if (d.kind === "card") {
          const { bx, by } = s2b(e.clientX, e.clientY);
          const objs = objRef.current;
          const card = objs.find((o) => o.id === d.id) as Card | undefined;
          if (card) {
            let next = removeCardFromArea(objs, d.id);
            const deck = objs.filter((o) => o.kind === "deck").find((a) => ptInArea(bx, by, a as Deck)) as Deck | undefined;
            if (deck) {
              // 潜り込みドラッグで山札に入れた場合は、カード束の一番下に入る
              next = addCardToArea(next, d.id, deck.id, "deck", d.burrow ? "bottom" : "top");
            } else {
              const hand = objs.filter((o) => o.kind === "hand").find((a) => ptInArea(bx, by, a as Hand)) as Hand | undefined;
              if (hand) {
                next = addCardToArea(next, d.id, hand.id, "hand");
              } else if (!d.burrow) {
                const updCard = next.find((o) => o.id === d.id) as Card | undefined;
                if (updCard) {
                  const chips = next.filter((o) => o.kind === "chip" && (updCard.chipIds || []).includes(o.id)) as Chip[];
                  let chipsUpd = chips.map((ch) => ({ ...ch, ...clampChipToCard(ch, updCard) }));
                  chipsUpd = resolveChipCollisions(chipsUpd);
                  next = next.map((o) => chipsUpd.find((c) => c.id === o.id) || o);
                }
              }
            }
            // エリアに入った場合は addCardToArea 内で既にZ順を決定済み。
            // 開いた盤面に置かれた場合のみ、ここでZ順（潜り込みなら最背面）を決める。
            const landedCard = next.find((o) => o.id === d.id) as Card | undefined;
            if (landedCard && !landedCard.ownArea) {
              const zOrder = d.burrow
                ? prevZ(next.filter((o) => o.kind === "card" && !(o as Card).ownArea), "card")
                : nextZ(next.filter((o) => o.kind === "card" && !(o as Card).ownArea), "card");
              next = next.map((o) => (o.id === d.id ? { ...o, zOrder } : o));
            }
            applyObjectsLocally(next);
            dispatch({ kind: "setObjects", objects: next });
          }
        } else if (d.kind === "chip") {
          const objs = objRef.current;
          const chip = objs.find((o) => o.id === d.id) as Chip | undefined;
          if (chip) {
            let next = objs.map((o) => (o.kind === "card" ? { ...o, chipIds: (o as Card).chipIds.filter((cid) => cid !== d.id) } : o));
            const target = next.filter((o) => o.kind === "card").find((c) => chipOnCard(chip, c as Card)) as Card | undefined;
            if (target) {
              next = next.map((o) => (o.id === target.id ? { ...o, chipIds: [...(o as Card).chipIds, d.id] } : o));
              const clamped = clampChipToCard(chip, target);
              next = next.map((o) => (o.id === d.id ? { ...o, ...clamped } : o));
            }
            const maxZ = nextZ(next.filter((o) => o.kind === "chip"), "chip");
            next = next.map((o) => (o.id === d.id ? { ...o, zOrder: maxZ } : o));
            const chips = next.filter((o) => o.kind === "chip") as Chip[];
            const resolved = resolveChipCollisions(chips);
            next = next.map((o) => resolved.find((c) => c.id === o.id) || o);
            applyObjectsLocally(next);
            dispatch({ kind: "setObjects", objects: next });
          }
        } else {
          dispatch({ kind: "setObjects", objects: objRef.current });
        }
      } else if (d && d.isHandle) {
        // ハンドルドラッグ終了時も最終状態を確定送信
        dispatch({ kind: "setObjects", objects: objRef.current });
      }
      rotDrag.current = null;
      drag.current = null;
      panDrag.current = null;
      setBurrowId(null);
    };

    // 潜り込みドラッグ（右ドラッグ）の後に、ブラウザ標準のcontextmenuや
    // カードの右クリックメニューが誤って開かないよう、捕捉フェーズで止める。
    const onContextMenuCapture = (e: MouseEvent) => {
      if (suppressCtxMenuRef.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressCtxMenuRef.current = false;
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("contextmenu", onContextMenuCapture, true);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("contextmenu", onContextMenuCapture, true);
    };
  }, [s2b, isOverSidebar, applyObjectsLocally, scheduleSend, dispatch]);

  const onBoardDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) {
        e.preventDefault();
        const rect = boardRef.current!.getBoundingClientRect();
        const cx = rect.left + rect.width / 2,
          cy = rect.top + rect.height / 2;
        rotDrag.current = { startAngle: camRot, startMouseAngle: (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI };
      }
      if (e.button === 0) panDrag.current = { active: true };
    },
    [camRot]
  );

  // カーソル位置の共有はゲーム状態に影響しないため、1フレームに1回だけ送信する
  const cursorSendRafRef = useRef(false);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const onBoardMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { bx, by } = s2b(e.clientX, e.clientY);
      pendingCursorRef.current = { x: bx, y: by };
      if (!cursorSendRafRef.current) {
        cursorSendRafRef.current = true;
        requestAnimationFrame(() => {
          cursorSendRafRef.current = false;
          if (pendingCursorRef.current) sendCursor(pendingCursorRef.current.x, pendingCursorRef.current.y);
        });
      }
    },
    [s2b, sendCursor]
  );

  const startDrag = useCallback(
    (e: React.MouseEvent, id: string, kind: string, isHandle = false, opts: any = {}) => {
      if (opts.burrow) {
        if (e.button !== 2) return;
      } else if (e.button !== 0) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      drag.current = { id, kind, isHandle, ...opts };
      panDrag.current = null;

      if (opts.burrow && kind === "card") {
        // 潜り込みドラッグ開始: 見た目を暗く沈めて表示し、乗っているチップは切り離す（追従させない）
        setBurrowId(id);
        const card = objRef.current.find((o) => o.id === id) as Card | undefined;
        if (card && card.chipIds.length > 0) {
          dispatch({ kind: "updateObj", id, patch: { chipIds: [] } });
        }
        return;
      }

      if (!isHandle && (kind === "card" || kind === "chip")) {
        const maxZ = nextZ(objRef.current.filter((o) => o.kind === kind), kind as GameObject["kind"]);
        const next = objRef.current.map((o) => (o.id === id ? { ...o, zOrder: maxZ } : o));
        applyObjectsLocally(next);
        scheduleSend({ kind: "updateObj", id, patch: { zOrder: maxZ } });
      }
    },
    [applyObjectsLocally, scheduleSend, dispatch]
  );

  const onBoardDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!draggingFromSidebar) return;
      const { bx, by } = s2b(e.clientX, e.clientY);
      const objs = objRef.current;
      let next: GameObject[] = objs;

      if (draggingFromSidebar.type === "cardDef") {
        const def = draggingFromSidebar.data;
        const z = nextZ(objs.filter((o) => o.kind === "card"), "card");
        const card = mkCardFromDef({ text: def.text, imageDataId: def.imageDataId, defId: def.defId }, bx - 45, by - 63, z);
        next = [...objs, card];
        const deck = objs.filter((o) => o.kind === "deck").find((a) => ptInArea(bx, by, a as Deck)) as Deck | undefined;
        if (deck) next = addCardToArea(next, card.id, deck.id, "deck");
        else {
          const hand = objs.filter((o) => o.kind === "hand").find((a) => ptInArea(bx, by, a as Hand)) as Hand | undefined;
          if (hand) next = addCardToArea(next, card.id, hand.id, "hand");
        }
      } else if (draggingFromSidebar.type === "chip") {
        const cd = draggingFromSidebar.data;
        const z = nextZ(objs.filter((o) => o.kind === "chip"), "chip");
        const chip = mkChip(bx - 19, by - 19, cd, z);
        next = [...objs, chip];
        const target = next.filter((o) => o.kind === "card").find((c) => chipOnCard(chip, c as Card)) as Card | undefined;
        if (target) {
          next = next.map((o) => (o.id === target.id ? { ...o, chipIds: [...(o as Card).chipIds, chip.id] } : o));
          const clamped = clampChipToCard(chip, target);
          next = next.map((o) => (o.id === chip.id ? { ...o, ...clamped } : o));
        }
      } else if (draggingFromSidebar.type === "deck") {
        next = [...objs, mkDeck(bx - 55, by - 75)];
      } else if (draggingFromSidebar.type === "hand") {
        next = [...objs, mkHand(bx - 150, by - 65)];
      } else if (draggingFromSidebar.type === "counter") {
        next = [...objs, mkCounter(bx - 45, by - 40)];
      }

      applyObjectsLocally(next);
      dispatch({ kind: "setObjects", objects: next });
      setDraggingFromSidebar(null);
    },
    [draggingFromSidebar, s2b, applyObjectsLocally, dispatch]
  );

  const onDblClick = useCallback(
    (e: React.MouseEvent, obj: GameObject) => {
      e.stopPropagation();
      if (obj.kind === "deck") {
        const objs = objRef.current;
        const cards = objs.filter((o) => o.kind === "card" && (o as Card).ownArea?.id === obj.id) as Card[];
        const zOrders = cards.map((c) => c.zOrder).sort((a, b) => a - b);
        const shuffled = [...zOrders].sort(() => Math.random() - 0.5);
        const zMap: Record<string, number> = {};
        cards.forEach((c, i) => {
          zMap[c.id] = shuffled[i];
        });
        const next = objs.map((o) => (zMap[o.id] !== undefined ? { ...o, zOrder: zMap[o.id] } : o));
        applyObjectsLocally(next);
        dispatch({ kind: "setObjects", objects: next });
        flash(obj.id);
      }
      if (obj.kind === "hand") {
        dispatch({ kind: "updateObj", id: obj.id, patch: { ownerId: myId } });
      }
      if (obj.kind === "card" && mode === "edit") {
        setEditTarget(obj);
      }
    },
    [mode, myId, dispatch, applyObjectsLocally, flash]
  );

  const onCtxMenu = useCallback((e: React.MouseEvent, obj: GameObject) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, obj });
  }, []);

  const onToggleFace = useCallback(
    (id: string) => {
      const target = objRef.current.find((o) => o.id === id) as Card | undefined;
      if (!target) return;
      dispatch({ kind: "updateObj", id, patch: { faceDown: !target.faceDown } });
      flash(id);
    },
    [dispatch, flash]
  );

  const onChangeCounter = useCallback(
    (id: string, delta: number) => {
      const target = objRef.current.find((o) => o.id === id) as any;
      if (!target) return;
      dispatch({ kind: "updateObj", id, patch: { value: target.value + delta } });
    },
    [dispatch]
  );

  const storeImage = useCallback(
    (defId: string, base64: string) => {
      dispatch({ kind: "setImage", imageDataId: defId, data: base64 });
    },
    [dispatch]
  );

  const saveCardDef = useCallback(
    (patch: { text: string; imageDataId: string | null }) => {
      if (cardDefDlg?.mode === "new") {
        const nd: CardDef = { defId: `def_${Date.now().toString(36)}`, text: patch.text, imageDataId: patch.imageDataId };
        dispatch({ kind: "setCardDefs", cardDefs: [...cardDefs, nd] });
      } else if (cardDefDlg?.def) {
        const def = cardDefDlg.def;
        dispatch({ kind: "setCardDefs", cardDefs: cardDefs.map((d) => (d.defId === def.defId ? { ...d, ...patch } : d)) });
        const next = objects.map((o) => (o.kind === "card" && (o as Card).defId === def.defId ? { ...o, ...patch } : o));
        dispatch({ kind: "setObjects", objects: next });
      }
      setCardDefDlg(null);
    },
    [cardDefDlg, cardDefs, objects, dispatch]
  );

  const saveCardDefsBulk = useCallback(
    (defs: { text: string; imageDataId: string | null }[]) => {
      const newDefs: CardDef[] = defs.map((d, i) => ({
        defId: `def_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        text: d.text,
        imageDataId: d.imageDataId,
      }));
      dispatch({ kind: "setCardDefs", cardDefs: [...cardDefs, ...newDefs] });
      setCardDefDlg(null);
    },
    [cardDefs, dispatch]
  );

  const saveChipDef = useCallback(
    (patch: { label: string; color: string; effect: import("@/lib/types").ChipEffect }) => {
      if (chipDefDlg?.def) {
        const def = chipDefDlg.def;
        dispatch({ kind: "setChipDefs", chipDefs: chipDefs.map((d) => (d.defId === def.defId ? { ...d, ...patch } : d)) });
      } else {
        const nd: ChipDef = { defId: `chipdef_${Date.now().toString(36)}`, ...patch };
        dispatch({ kind: "setChipDefs", chipDefs: [...chipDefs, nd] });
      }
      setChipDefDlg(null);
    },
    [chipDefDlg, chipDefs, dispatch]
  );

  const deleteChipDef = useCallback(
    (defId: string) => {
      dispatch({ kind: "setChipDefs", chipDefs: chipDefs.filter((d) => d.defId !== defId) });
    },
    [chipDefs, dispatch]
  );

  const reorderCardDefs = useCallback(
    (next: CardDef[]) => {
      dispatch({ kind: "setCardDefs", cardDefs: next });
    },
    [dispatch]
  );

  const reorderChipDefs = useCallback(
    (next: ChipDef[]) => {
      dispatch({ kind: "setChipDefs", chipDefs: next });
    },
    [dispatch]
  );

  const doSave = useCallback(() => {
    saveRoomZip(room, roomId);
  }, [room, roomId]);

  const doLoad = useCallback(
    async (file: File) => {
      const loaded = await loadRoomZip(file);
      dispatch({ kind: "setObjects", objects: loaded.objects });
      dispatch({ kind: "setCardDefs", cardDefs: loaded.cardDefs });
      dispatch({ kind: "setChipDefs", chipDefs: loaded.chipDefs });
      dispatch({ kind: "setPlayers", players: loaded.players });
      dispatch({ kind: "setImageStore", imageStore: loaded.imageStore });
      dispatch({ kind: "setMode", mode: loaded.mode });
    },
    [dispatch]
  );

  // ── レンダリング ──────────────────────────────────────────
  const sortedObjs = [...objects].sort((a, b) => {
    const kz = kindZOf(a.kind) - kindZOf(b.kind);
    if (kz !== 0) return kz;
    return ((a as any).zOrder || 0) - ((b as any).zOrder || 0);
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0d1117", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif", userSelect: "none", overflow: "hidden" }}>
      {sidebar && (
        <Sidebar
          sidebarRef={sidebarRef}
          sidebarTab={sidebarTab}
          setSidebarTab={setSidebarTab}
          cardDefs={cardDefs}
          chipDefs={chipDefs}
          imageStore={imageStore}
          onNewCardDef={() => setCardDefDlg({ mode: "new" })}
          onDragStartCardDef={(e, def) => {
            e.dataTransfer.effectAllowed = "copy";
            setDraggingFromSidebar({ type: "cardDef", data: def });
          }}
          onDblClickCardDef={(e, def) => {
            e.stopPropagation();
            setCardDefDlg({ mode: "edit", def });
          }}
          onCtxMenuCardDef={(e, def) => {
            e.preventDefault();
            e.stopPropagation();
            setSbCtxMenu({ x: e.clientX, y: e.clientY, kind: "card", def });
          }}
          onNewChipDef={() => setChipDefDlg({})}
          onDragStartChip={(e, def) => {
            e.dataTransfer.effectAllowed = "copy";
            setDraggingFromSidebar({ type: "chip", data: def });
          }}
          onDblClickChipDef={(e, def) => {
            e.stopPropagation();
            setChipDefDlg({ def });
          }}
          onCtxMenuChipDef={(e, def) => {
            e.preventDefault();
            e.stopPropagation();
            setSbCtxMenu({ x: e.clientX, y: e.clientY, kind: "chip", def });
          }}
          onReorderCardDefs={reorderCardDefs}
          onReorderChipDefs={reorderChipDefs}
          onDragStartOther={(e, type) => {
            e.dataTransfer.effectAllowed = "copy";
            setDraggingFromSidebar({ type, data: {} });
          }}
        />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ height: 46, background: "#161b22", borderBottom: "1px solid #30363d", display: "flex", alignItems: "center", padding: "0 14px", gap: 10, flexShrink: 0 }}>
          <button onClick={() => setSidebar((v) => !v)} style={tb()}>
            {sidebar ? "◀" : "▶"} Panel
          </button>
          <div style={{ width: 1, height: 22, background: "#30363d" }} />
          <button onClick={() => isOwner && dispatch({ kind: "setMode", mode: "edit" })} style={tb(mode === "edit")} disabled={!isOwner} title={!isOwner ? "オーナーのみ切替可能" : ""}>
            ✏️ 編集
          </button>
          <button onClick={() => isOwner && dispatch({ kind: "setMode", mode: "play" })} style={tb(mode === "play")} disabled={!isOwner} title={!isOwner ? "オーナーのみ切替可能" : ""}>
            ▶ 対戦
          </button>
          <div style={{ width: 1, height: 22, background: "#30363d" }} />
          <button onClick={doSave} style={tb()}>💾 保存</button>
          <button onClick={() => fileInputRef.current?.click()} style={tb()}>📂 読込</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doLoad(f);
              e.target.value = "";
            }}
          />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: connected ? "#4ade80" : "#f87171" }}>{connected ? "● 接続中" : "○ 切断"}</span>
            <button onClick={() => setShowPlayerDlg(true)} style={{ ...tb(), background: "#21262d", color: "#c4b5fd", borderColor: "#4c1d95" }}>
              👤 {myName}
            </button>
            <span style={{ fontSize: 11, color: "#8b949e" }}>
              左D:移動 右D:回転({Math.round(((camRot % 360) + 360) % 360)}°) ホイール:ズーム({Math.round(camZoom * 100)}%)
            </span>
          </div>
        </div>

        <div
          ref={boardRef}
          style={{ flex: 1, overflow: "hidden", position: "relative", cursor: "crosshair" }}
          onMouseDown={onBoardDown}
          onMouseMove={onBoardMouseMove}
          onContextMenu={(e) => e.preventDefault()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onBoardDrop}
        >
          <div style={{ position: "absolute", inset: 0, transform: `rotate(${camRot}deg) scale(${camZoom})`, transformOrigin: "center center", pointerEvents: "none" }}>
            <div style={{ position: "absolute", inset: 0, transform: `translate(${camOffset.x}px,${camOffset.y}px)`, pointerEvents: "none" }}>
              <div style={{ position: "absolute", inset: "-200%", backgroundImage: "radial-gradient(circle,#21262d 1px,transparent 1px)", backgroundSize: "40px 40px", opacity: 0.5, pointerEvents: "none" }} />
              {sortedObjs.map((obj) => (
                <ObjRender
                  key={obj.id}
                  obj={obj}
                  mode={mode}
                  myId={myId}
                  objects={objects}
                  imageStore={imageStore}
                  startDrag={startDrag}
                  onDblClick={onDblClick}
                  onCtxMenu={onCtxMenu}
                  onChangeCounter={onChangeCounter}
                  onToggleFace={onToggleFace}
                  flashId={flashId}
                  onHoverCard={setHoverCardId}
                  onFlash={flash}
                  burrowId={burrowId}
                />
              ))}
              {Object.entries(cursors)
                .filter(([pid]) => pid !== myId)
                .map(([pid, pos]) => {
                  const pl = players.find((p) => p.id === pid);
                  if (!pl) return null;
                  return (
                    <div
                      key={pid}
                      style={{
                        position: "absolute",
                        left: pos.x,
                        top: pos.y,
                        transform: "translate(-2px, -2px)",
                        pointerEvents: "none",
                        zIndex: 9998,
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: pl.color || "#60a5fa", border: "2px solid #fff", boxShadow: "0 0 4px rgba(0,0,0,0.6)" }} />
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          fontWeight: 700,
                          color: pl.color || "#60a5fa",
                          whiteSpace: "nowrap",
                          WebkitTextStroke: "3px white",
                          paintOrder: "stroke fill",
                        } as React.CSSProperties}
                      >
                        {pl.name}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {(() => {
            const hc = hoverCardId ? (objects.find((o) => o.id === hoverCardId) as Card | undefined) : null;
            if (!hc) return null;
            const hand = hc.ownArea?.kind === "hand" ? (objects.find((o) => o.id === hc.ownArea!.id) as Hand | undefined) : null;
            const isMyHand = hand?.ownerId === myId;
            const showContent = !hc.faceDown || isMyHand;
            if (!showContent) return null;
            return (
              <div
                style={{
                  position: "absolute",
                  bottom: 60,
                  right: 20,
                  width: 160,
                  height: 224,
                  background: imageStore[hc.imageDataId || hc.defId || ""] ? "#000" : "linear-gradient(160deg,#1e2d3d,#111827)",
                  border: `2px solid ${hc.faceDown && isMyHand ? "#a78bfa" : "#60a5fa"}`,
                  borderRadius: 12,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  color: "#e2e8f0",
                  textAlign: "center",
                  padding: 10,
                  pointerEvents: "none",
                  zIndex: 500,
                  overflow: "hidden",
                  opacity: hc.faceDown && isMyHand ? 0.7 : 1,
                }}
              >
                {hc.faceDown && isMyHand && (
                  <div style={{ position: "absolute", top: 4, right: 4, fontSize: 9, background: "rgba(167,139,250,0.3)", borderRadius: 3, padding: "1px 4px", color: "#c4b5fd" }}>自分のみ</div>
                )}
                {imageStore[hc.imageDataId || hc.defId || ""] ? (
                  <img src={imageStore[hc.imageDataId || hc.defId || ""]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                ) : (
                  hc.text
                )}
              </div>
            );
          })()}

          <div
            style={{
              position: "absolute",
              bottom: 14,
              right: 14,
              background: mode === "edit" ? "rgba(31,45,68,0.53)" : "rgba(20,49,15,0.53)",
              border: `1px solid ${mode === "edit" ? "#3b82f6" : "#22c55e"}`,
              borderRadius: 8,
              padding: "3px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: mode === "edit" ? "#93c5fd" : "#86efac",
            }}
          >
            {mode === "edit" ? "✏️ 編集モード" : "▶ 対戦モード"}
          </div>
        </div>
      </div>

      {showPlayerDlg && (
        <PlayerDlg
          players={players}
          myId={myId}
          connectedIds={connectedIds}
          onSelectMe={(id) => assumeIdentity(id)}
          onUpdateName={(id, name) => {
            if (id === myId) setMyName(name);
          }}
          onUpdateColor={(id, color) => {
            if (id === myId) setMyColor(color);
          }}
          onAddPlayer={() => {
            const id = `player_${Math.random().toString(36).slice(2, 9)}`;
            dispatch({
              kind: "setPlayers",
              players: [...players, { id, name: `プレイヤー${players.length + 1}`, color: pickPlayerColor(id) }],
            });
          }}
          onDeletePlayer={(id) => {
            dispatch({ kind: "setPlayers", players: players.filter((p) => p.id !== id) });
          }}
          onClose={() => setShowPlayerDlg(false)}
        />
      )}

      {ctxMenu && (
        <CtxMenu
          menu={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onEdit={() => {
            setEditTarget(ctxMenu.obj);
            setCtxMenu(null);
          }}
          onDelete={() => {
            dispatch({ kind: "deleteObj", id: ctxMenu.obj.id });
            setCtxMenu(null);
          }}
          onDuplicate={
            ctxMenu.obj.kind === "deck"
              ? () => {
                  const d = ctxMenu.obj as Deck;
                  const cards = objects.filter((o) => o.kind === "card" && (o as Card).ownArea?.id === d.id) as Card[];
                  const nd = mkDeck(d.x + 20, d.y + 20);
                  nd.name = d.name;
                  nd.w = d.w;
                  nd.h = d.h;
                  nd.rotation = d.rotation || 0;
                  const newCards = cards.map((c, i) => ({
                    ...mkCardFromDef({ text: c.text, imageDataId: c.imageDataId, defId: c.defId || undefined }, c.x + 20, c.y + 20, i),
                    ownArea: { kind: "deck" as const, id: nd.id },
                  }));
                  dispatch({ kind: "setObjects", objects: [...objects, nd, ...newCards] });
                  setCtxMenu(null);
                }
              : null
          }
        />
      )}
      {sbCtxMenu && (
        <SbCtxMenu
          menu={sbCtxMenu}
          onClose={() => setSbCtxMenu(null)}
          onEdit={() => {
            if (sbCtxMenu.kind === "card") setCardDefDlg({ mode: "edit", def: sbCtxMenu.def as CardDef });
            else setChipDefDlg({ def: sbCtxMenu.def as ChipDef });
            setSbCtxMenu(null);
          }}
          onDelete={() => {
            if (sbCtxMenu.kind === "card") {
              dispatch({ kind: "setCardDefs", cardDefs: cardDefs.filter((d) => d.defId !== sbCtxMenu.def.defId) });
            } else {
              deleteChipDef(sbCtxMenu.def.defId);
            }
            setSbCtxMenu(null);
          }}
        />
      )}
      {editTarget && (
        <EditDlg
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(patch) => {
            dispatch({ kind: "updateObj", id: editTarget.id, patch });
            setEditTarget(null);
          }}
        />
      )}
      {cardDefDlg && (
        <CardDefDlg
          mode={cardDefDlg.mode}
          def={cardDefDlg.def}
          imageStore={imageStore}
          storeImage={storeImage}
          onClose={() => setCardDefDlg(null)}
          onSave={saveCardDef}
          onSaveBulk={saveCardDefsBulk}
          newImageDataId={`img_${Date.now().toString(36)}`}
        />
      )}
      {chipDefDlg && <ChipDefDlg def={chipDefDlg.def} onClose={() => setChipDefDlg(null)} onSave={saveChipDef} />}
    </div>
  );
}
