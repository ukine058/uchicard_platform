"use client";

import JSZip from "jszip";
import type { CardDef, GameObject, Player, RoomState } from "./types";

type RoomJson = {
  version: 1;
  mode: "edit" | "play";
  players: Player[];
  cardDefs: CardDef[];
  objects: GameObject[];
};

function extFromDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:image\/(\w+);base64,/);
  if (!m) return "png";
  const type = m[1].toLowerCase();
  if (type === "jpeg") return "jpg";
  return type;
}

function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

function base64ToDataUrl(base64: string, ext: string): string {
  const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return `data:${mime};base64,${base64}`;
}

export async function saveRoomZip(room: RoomState, roomId: string): Promise<void> {
  const zip = new JSZip();

  const roomJson: RoomJson = {
    version: 1,
    mode: room.mode,
    players: room.players,
    cardDefs: room.cardDefs,
    objects: room.objects,
  };
  zip.file("room.json", JSON.stringify(roomJson, null, 2));

  const imagesFolder = zip.folder("images");
  for (const [imageDataId, dataUrl] of Object.entries(room.imageStore)) {
    const ext = extFromDataUrl(dataUrl);
    const base64 = dataUrlToBase64(dataUrl);
    imagesFolder?.file(`${imageDataId}.${ext}`, base64, { base64: true });
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `room-${roomId}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function loadRoomZip(file: File): Promise<{
  mode: "edit" | "play";
  players: Player[];
  cardDefs: CardDef[];
  objects: GameObject[];
  imageStore: { [imageDataId: string]: string };
}> {
  const zip = await JSZip.loadAsync(file);

  const roomJsonText = await zip.file("room.json")?.async("string");
  if (!roomJsonText) throw new Error("room.json が見つかりません");
  const roomJson: RoomJson = JSON.parse(roomJsonText);

  const imageStore: { [imageDataId: string]: string } = {};
  const imagesFolder = zip.folder("images");
  if (imagesFolder) {
    const entries: { name: string; obj: JSZip.JSZipObject }[] = [];
    imagesFolder.forEach((relPath, entry) => {
      if (!entry.dir) entries.push({ name: relPath, obj: entry });
    });
    for (const { name, obj } of entries) {
      const base64 = await obj.async("base64");
      const ext = name.split(".").pop() || "png";
      const imageDataId = name.replace(/\.[^.]+$/, "");
      imageStore[imageDataId] = base64ToDataUrl(base64, ext);
    }
  }

  return {
    mode: roomJson.mode,
    players: roomJson.players,
    cardDefs: roomJson.cardDefs,
    objects: roomJson.objects,
    imageStore,
  };
}
