# カードゲームプラットフォーム（本番実装）

仕様書 `spec-for-session-b_2.md` に基づく実装です。プロトタイプ（単一HTMLファイル・ローカルstateのみ）を、
「フロントエンド（Next.js）＋ リアルタイム同期サーバー（Cloudflare Workers + Durable Objects）」の
2層構成に分割しています。

## 構成

```
app/                  Next.jsアプリ（フロントエンド）
  page.tsx              トップ画面（ルーム入室）
  room/[roomId]/        ゲームルーム画面
components/
  Board.tsx             盤面のメインロジック（カメラ操作・D&D・ドラッグ）
  objects.tsx           カード/チップ/山札/手札/カウンターの描画
  Sidebar.tsx           左サイドバー（カード・チップ・その他）
  Dialogs.tsx           各種ダイアログ・コンテキストメニュー
hooks/
  useRoomSocket.ts      WebSocket接続・状態同期フック
  useHoverDelay.ts      ホバー猶予表示フック
lib/
  types.ts              共有型定義（Worker側とも共有）
  gameLogic.ts          純粋関数のゲームロジック（Worker側とも共有）
  zip.ts                ZIP保存・読み込み（jszip）
worker/
  index.ts              Cloudflare Workerエントリ（WebSocketルーティング）
  RoomObject.ts          Durable Object本体（ルーム状態・ブロードキャスト）
wrangler.toml           Cloudflare Workers設定
```

## 同期の仕組み

- ルームごとに1つの Durable Object インスタンスが作られ、そのメモリ上にのみ状態を保持します（DBなし、
  仕様通り）。全員が切断すると状態は破棄されます。
- クライアントは操作を `Action`（`lib/types.ts` 参照）としてWebSocket経由で送信し、サーバーは
  `applyAction`（`lib/gameLogic.ts`）で状態を更新してから他クライアントへブロードキャストします。
- ドラッグ中の連続的な移動は、ローカルには毎フレーム即時反映（楽観的UI）しつつ、サーバーへの送信は
  `requestAnimationFrame` で1フレーム1回に間引いています。
- WebSocket Hibernation API を使用しており、操作がない間はDurable Objectがスリープしてコストを抑えます。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Cloudflare Worker（同期サーバー）のデプロイ

```bash
npx wrangler login       # 初回のみ
npm run worker:deploy
```

デプロイ完了後に表示されるURL（例: `https://cardgame-room-server.xxxx.workers.dev`）を控えてください。

### 3. フロントエンドの環境変数設定

`.env.local.example` を `.env.local` にコピーし、`NEXT_PUBLIC_WS_HOST` を上記WorkerのURLの
`https://` を `wss://` に変えたものに書き換えます。

```
NEXT_PUBLIC_WS_HOST=wss://cardgame-room-server.xxxx.workers.dev
```

### 4. ローカル動作確認

Worker側（別ターミナル、ローカルで起動）:
```bash
npm run worker:dev
# 既定では ws://127.0.0.1:8787 で待受
```

フロントエンド:
```bash
npm run dev
# http://localhost:3000
```

### 5. 本番デプロイ（フロントエンド）

Vercel等にNext.jsアプリをデプロイし、環境変数 `NEXT_PUBLIC_WS_HOST` に本番Worker URLを設定してください。

## 既知の制約・今後の改善余地

- エリア（山札/手札）のリサイズ操作は、簡易化のため変更後の全オブジェクト配列を都度サーバーへ送る
  実装になっています（頻度が低い操作のため実用上は問題ありませんが、差分送信に最適化する余地があります）。
- 認証・ルームの永続化（リロード後も状態を残す等）は仕様に含まれていないため未実装です。将来的に
  Durable Object Storage への永続化を有効にする場合は `RoomObject.persist()` を起点に拡張できます。
- 画像はBase64のままDurable Objectのメモリ・WebSocketで扱っています。大量・高解像度画像を扱う場合は
  R2などの外部ストレージへの切り出しを検討してください。
