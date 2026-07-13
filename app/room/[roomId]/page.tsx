"use client";

import dynamic from "next/dynamic";

// WebSocket/sessionStorageに依存するためクライアント専用でロード
const Board = dynamic(() => import("@/components/Board"), { ssr: false });

export default function RoomPage({ params }: { params: { roomId: string } }) {
  return <Board roomId={params.roomId} />;
}
