"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function randomRoomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export default function TopPage() {
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const join = () => {
    const id = roomId.trim();
    if (!id) return;
    router.push(`/room/${encodeURIComponent(id)}`);
  };

  const createNew = () => {
    router.push(`/room/${randomRoomId()}`);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 14,
          padding: 32,
          minWidth: 340,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
          🎴 カードゲームプラットフォーム
        </div>

        <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 8 }}>ルームIDを入力して入室</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") join();
            }}
            placeholder="例: abc123"
            style={{
              flex: 1,
              background: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: 6,
              padding: "8px 10px",
              color: "#e2e8f0",
              fontSize: 13,
            }}
          />
          <button
            onClick={join}
            style={{
              background: "#1d4ed8",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            入室
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, color: "#374151" }}>
          <div style={{ flex: 1, height: 1, background: "#30363d" }} />
          <span style={{ fontSize: 11 }}>または</span>
          <div style={{ flex: 1, height: 1, background: "#30363d" }} />
        </div>

        <button
          onClick={createNew}
          style={{
            width: "100%",
            background: "#21262d",
            border: "1px solid #30363d",
            borderRadius: 6,
            padding: "9px 0",
            color: "#e2e8f0",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ＋ 新しいルームを作る
        </button>
      </div>
    </div>
  );
}
