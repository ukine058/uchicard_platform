"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyAction } from "@/lib/gameLogic";
import type { Action, ClientMessage, Player, RoomState, ServerMessage } from "@/lib/types";
import { CHIP_DEFS } from "@/lib/types";

function emptyState(): RoomState {
  return { ownerId: null, mode: "edit", players: [], cardDefs: [], chipDefs: [...CHIP_DEFS], objects: [], imageStore: {} };
}

function getOrCreateMyId(): string {
  if (typeof window === "undefined") return "player_ssr";
  const key = "cardgame_myId";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `player_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

function getOrCreateMyName(id: string): string {
  if (typeof window === "undefined") return id;
  const key = "cardgame_myName";
  let name = sessionStorage.getItem(key);
  if (!name) {
    name = "プレイヤー";
    sessionStorage.setItem(key, name);
  }
  return name;
}

export type CursorInfo = { x: number; y: number };

export function useRoomSocket(roomId: string) {
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomState>(emptyState());
  const [myId, setMyId] = useState<string>(() => getOrCreateMyId());
  const [myName, setMyNameState] = useState<string>(() => getOrCreateMyName(myId));
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorInfo>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    const host = process.env.NEXT_PUBLIC_WS_HOST || "ws://127.0.0.1:8787";
    const ws = new WebSocket(`${host}/ws/${encodeURIComponent(roomId)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      const join: ClientMessage = { type: "join", playerId: myId, playerName: myName };
      ws.send(JSON.stringify(join));
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (ev) => {
      const msg: ServerMessage = JSON.parse(ev.data);
      if (msg.type === "init") {
        // 古いスキーマの状態が送られてきても不足項目で落ちないようデフォルトとマージ
        setRoom({ ...emptyState(), ...msg.state });
        setConnectedIds(msg.connectedIds);
      } else if (msg.type === "action") {
        setRoom((p) => applyAction(p, msg.payload));
      } else if (msg.type === "players") {
        setRoom((p) => ({ ...p, players: msg.players }));
        setConnectedIds(msg.connectedIds);
        // 退出したプレイヤーのカーソル表示は消す
        setCursors((prev) => {
          const ids = new Set(msg.players.map((p) => p.id));
          const next: Record<string, CursorInfo> = {};
          for (const [k, v] of Object.entries(prev)) if (ids.has(k)) next[k] = v;
          return next;
        });
      } else if (msg.type === "cursor") {
        setCursors((prev) => ({ ...prev, [msg.playerId]: { x: msg.x, y: msg.y } }));
      }
    };

    return () => {
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ローカル状態にのみ反映（ドラッグ中の毎フレーム更新など、送信を伴わない場合）
  const applyLocal = useCallback((action: Action) => {
    setRoom((p) => applyAction(p, action));
  }, []);

  // サーバーへ送信のみ（ローカルには既に反映済みの場合に使う）
  const send = useCallback((action: Action) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg: ClientMessage = { type: "action", payload: action };
      ws.send(JSON.stringify(msg));
    }
  }, []);

  // Action送信: ローカルに楽観反映してからサーバーに送る（離散的な操作用）
  const dispatch = useCallback(
    (action: Action) => {
      applyLocal(action);
      send(action);
    },
    [applyLocal, send]
  );

  // 自分の名前を変更（自分が現在選んでいるプレイヤーの名前を書き換える）
  const setMyName = useCallback(
    (name: string) => {
      setMyNameState(name);
      if (typeof window !== "undefined") sessionStorage.setItem("cardgame_myName", name);
      const players = roomRef.current.players.map((p: Player) => (p.id === myId ? { ...p, name } : p));
      dispatch({ kind: "setPlayers", players });
    },
    [dispatch, myId]
  );

  // 自分の色を変更
  const setMyColor = useCallback(
    (color: string) => {
      const players = roomRef.current.players.map((p: Player) => (p.id === myId ? { ...p, color } : p));
      dispatch({ kind: "setPlayers", players });
    },
    [dispatch, myId]
  );

  // 別のプレイヤー（未接続のもの）を自分として選び直す。
  // 同じWebSocket接続上で再度joinを送るだけで、サーバー側の紐付けが更新される。
  const assumeIdentity = useCallback(
    (targetId: string) => {
      if (targetId === myId) return;
      const target = roomRef.current.players.find((p) => p.id === targetId);
      const nextName = target?.name || myName;
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cardgame_myId", targetId);
        sessionStorage.setItem("cardgame_myName", nextName);
      }
      setMyId(targetId);
      setMyNameState(nextName);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const joinMsg: ClientMessage = { type: "join", playerId: targetId, playerName: nextName };
        ws.send(JSON.stringify(joinMsg));
      }
    },
    [myId, myName]
  );

  // カーソル位置の共有（ゲーム状態には残らない一時的なプレゼンス情報）
  const sendCursor = useCallback((x: number, y: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg: ClientMessage = { type: "cursor", x, y };
      ws.send(JSON.stringify(msg));
    }
  }, []);

  return {
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
  };
}
