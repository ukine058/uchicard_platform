"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyAction } from "@/lib/gameLogic";
import type { Action, ClientMessage, Player, RoomState, ServerMessage } from "@/lib/types";

function emptyState(): RoomState {
  return { ownerId: null, mode: "edit", players: [], cardDefs: [], chipDefs: [], objects: [], imageStore: {} };
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

export function useRoomSocket(roomId: string) {
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomState>(emptyState());
  const [myId] = useState<string>(() => getOrCreateMyId());
  const [myName, setMyNameState] = useState<string>(() => getOrCreateMyName(myId));

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
        setRoom(msg.state);
      } else if (msg.type === "action") {
        setRoom((p) => applyAction(p, msg.payload));
      } else if (msg.type === "players") {
        setRoom((p) => ({ ...p, players: msg.players }));
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

  const setMyName = useCallback(
    (name: string) => {
      setMyNameState(name);
      if (typeof window !== "undefined") sessionStorage.setItem("cardgame_myName", name);
      const players = roomRef.current.players.map((p: Player) => (p.id === myId ? { ...p, name } : p));
      dispatch({ kind: "setPlayers", players });
    },
    [dispatch, myId]
  );

  return { connected, room, myId, myName, setMyName, dispatch, applyLocal, send };
}
