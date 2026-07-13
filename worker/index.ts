// ── Worker: /ws/[roomId] へのアップグレードリクエストを対応する
// Durable Object（ルームごとに1インスタンス）にルーティングする ──

export { RoomObject } from "./RoomObject";

export interface Env {
  ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS プリフライト（フロントは別オリジン=Vercelから接続するため）
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const match = url.pathname.match(/^\/ws\/([a-zA-Z0-9_-]+)$/);
    if (!match) {
      return new Response("Not found. Use /ws/{roomId}", { status: 404 });
    }
    const roomId = match[1];

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    return stub.fetch(request);
  },
};
