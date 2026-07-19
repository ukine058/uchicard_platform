// ── RoomObject: ルームごとに1インスタンス。状態はメモリ上のみ。 ──
// WebSocket Hibernation API を使用してアイドル中の課金を抑える。

import { applyAction } from "../lib/gameLogic";
import type { RoomState, ClientMessage, ServerMessage } from "../lib/types";
import { CHIP_DEFS, pickPlayerColor } from "../lib/types";

export interface Env {
  ROOM: DurableObjectNamespace;
}

function emptyState(): RoomState {
  return {
    ownerId: null,
    mode: "edit",
    players: [],
    cardDefs: [],
    // 新規ルームのみ、組み込みチップ一式を初期値として持たせる。
    // （既に保存済みのルームは、保存済みの内容が優先される＝この初期値では上書きされない）
    chipDefs: [...CHIP_DEFS],
    objects: [],
    imageStore: {},
  };
}

// 各WebSocket接続にひもづくメタ情報（Hibernation対応: ws.serializeAttachmentで保持）
type ConnMeta = { playerId: string };

export class RoomObject implements DurableObject {
  state: DurableObjectState;
  env: Env;
  room: RoomState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.room = emptyState();
    // Hibernation復帰時に前回の状態をblockConcurrencyWhileで復元
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<RoomState>("room");
      // スキーマ移行対応: 新項目追加前に保存された古いデータには
      // chipDefs 等が存在しないため、デフォルト値で不足分を補う。
      if (stored) this.room = { ...emptyState(), ...stored };
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // Hibernation API: acceptWebSocketでイベントループから外れて待機可能にする
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    if (msg.type === "join") {
      const meta: ConnMeta = { playerId: msg.playerId };
      ws.serializeAttachment(meta);

      // プレイヤーロスターは接続状態とは独立して永続化する（切断してもロスターからは消えない）。
      // 既に存在するプレイヤーIDへの参加（＝プレイヤーの選び直し）の場合、
      // 既存の名前・色を上書きしない。
      const existing = this.room.players.find((p) => p.id === msg.playerId);
      if (!existing) {
        this.room.players = [
          ...this.room.players,
          { id: msg.playerId, name: msg.playerName, color: pickPlayerColor(msg.playerId) },
        ];
      }
      if (!this.room.ownerId) this.room.ownerId = msg.playerId;
      await this.persist();

      const init: ServerMessage = {
        type: "init",
        state: this.room,
        selfId: msg.playerId,
        connectedIds: this.getConnectedPlayerIds(),
      };
      ws.send(JSON.stringify(init));
      this.broadcastPlayers();
      return;
    }

    if (msg.type === "cursor") {
      const meta = ws.deserializeAttachment() as ConnMeta | null;
      if (!meta) return;
      // カーソル位置は状態に保存しない一時的な中継のみ（プレゼンス表示用）
      this.broadcast({ type: "cursor", playerId: meta.playerId, x: msg.x, y: msg.y }, ws);
      return;
    }

    if (msg.type === "action") {
      const meta = ws.deserializeAttachment() as ConnMeta | null;
      const fromId = meta?.playerId ?? "unknown";

      // モード変更はオーナーのみ許可
      if (msg.payload.kind === "setMode" && this.room.ownerId !== fromId) {
        return;
      }

      this.room = applyAction(this.room, msg.payload);
      await this.persist();

      const out: ServerMessage = { type: "action", payload: msg.payload, from: fromId };
      this.broadcast(out, ws);

      if (msg.payload.kind === "setPlayers") this.broadcastPlayers();
    }
  }

  async webSocketClose(ws: WebSocket) {
    const meta = ws.deserializeAttachment() as ConnMeta | null;
    if (meta) {
      // プレイヤーロスターからは削除しない（切断中でも選択・削除の対象として残す）。
      // オーナーだった場合のみ、他に接続中のプレイヤーへ委譲する。
      if (this.room.ownerId === meta.playerId) {
        const stillConnected = this.getConnectedPlayerIds(ws);
        this.room.ownerId = stillConnected[0] ?? null;
      }
      await this.persist();
      this.broadcastPlayers();
    }

    // 全員切断されたら状態を破棄（意図的な設計）
    if (this.state.getWebSockets().length === 0) {
      this.room = emptyState();
      await this.state.storage.deleteAll();
    }
  }

  async webSocketError(_ws: WebSocket, _error: unknown) {
    // 接続エラー時も close 相当のクリーンアップに任せる
  }

  private broadcast(msg: ServerMessage, exclude?: WebSocket) {
    const data = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      if (ws === exclude) continue;
      try {
        ws.send(data);
      } catch {
        // 送信失敗（切断済みなど）は無視
      }
    }
  }

  private broadcastPlayers() {
    this.broadcast({ type: "players", players: this.room.players, connectedIds: this.getConnectedPlayerIds() });
  }

  // 現在ライブなWebSocket接続にひもづくプレイヤーIDの一覧（重複除去）。
  // exclude を渡すとそのソケット自身は除外して数える（close処理での再計算用）。
  private getConnectedPlayerIds(exclude?: WebSocket): string[] {
    const ids = new Set<string>();
    for (const ws of this.state.getWebSockets()) {
      if (ws === exclude) continue;
      const meta = ws.deserializeAttachment() as ConnMeta | null;
      if (meta?.playerId) ids.add(meta.playerId);
    }
    return [...ids];
  }

  private async persist() {
    // Hibernation復帰用にストレージへ保存（実運用のバックアップとしても機能）
    await this.state.storage.put("room", this.room);
  }
}
