<template>
  <main ref="baseApp" class="layout">
    <section class="panel" v-if="!gameDisabled">
      <header>
        <h1>潜水艦ゲーム (7×7 / 2人)</h1>
        <div ref="phaseBadge" class="badge">
          配置フェーズ: プレイヤー1
        </div>
      </header>

      <h2 ref="currentPlayerLabel">プレイヤー1</h2>

      <div class="controls">
        <div class="group">
          <label>向き:</label>
          <button @click="handleRotate" title="Rキーでも切替">{{rotateBtnLabel}}</button>
        </div>
        <div class="group">
          <label>残りコマ</label>
          <div class="inventory">
            <button
              v-for="def in PIECES"
              :key="def.key"
              type="button"
              class="pieceBadge"
              :class="{ primary: gameStateView.selectedPieceKey === def.key }"
              :data-key="def.key"
              :disabled="inventoryItems[def.key] === 0"
              @click="handleInventoryClick(def.key)"
            >
              <span class="pieceIcon" :style="{ gridTemplateColumns: `repeat(${def.w}, auto)`, gridTemplateRows: `repeat(${def.h}, auto)` }">
                <span v-for="i in def.w * def.h" :key="i" class="sq"></span>
              </span>
              <span>{{ def.label }}（残:{{ inventoryItems[def.key] }}）</span>
            </button>
          </div>
        </div>
        <div class="group phaseOnlyPlacement">
          <button @click="handleUndo" type="button">直前の配置を戻す</button>
          <button @click="handleRandomize" type="button">ランダム配置</button>
          <button @click="handleLockIn" type="button" class="primary">この配置で確定</button>
        </div>
        <div class="group phaseOnlyBattle hidden">
          <button type="button">ターン終了（攻撃後）</button>
        </div>
      </div>

      <div class="boards">
        <div class="boardWrap">
          <h3>自分の盤面</h3>
          <div
            ref="ownBoardEl"
            class="board"
            data-board="own"
            @mousemove="handleOwnBoardMouseMove"
            @mouseleave="handleOwnBoardMouseLeave"
          >
            <div
              v-for="(cell, idx) in ownBoardCells"
              :key="idx"
              :class="['cell', ...cell.classes]"
              :data-index="idx"
              @click="handleOwnBoardClick(idx)"
            />
          </div>
          <small class="hint">配置フェーズ: 盤面をクリックしてコマを置く</small>
        </div>
        <div class="boardWrap">
          <h3>相手の盤面(攻撃用)</h3>
          <div
            ref="targetBoardEl"
            class="board"
            data-board="target"
            @click="handleTargetBoardClick"
          >
            <div
              v-for="(cell, idx) in targetBoardCells"
              :key="idx"
              :class="['cell', ...cell.classes]"
              :data-index="idx"
            />
          </div>
          <small class="hint">攻撃フェーズ: 盤面をクリックして攻撃</small>
        </div>
      </div>

      <div class="legend">
        <div><span class="cell miss"></span>外れ（薄いマーク）</div>
        <div><span class="cell hit"></span>命中（濃いマーク）</div>
      </div>

      <div class="footerBtns">
        <button type="button">最初からやり直す</button>
      </div>

      <!-- 状態のエクスポート / インポートUI -->
      <div class="stateIO" style="display:none">
        <h3>ゲーム状態 JSON</h3>
        <div class="stateIO-buttons">
          <button type="button">
            状態をJSONに出力（コピー）
          </button>
          <button type="button">
            JSONから状態を読み込み
          </button>
        </div>
        <textarea
          rows="6"
          placeholder="ここに状態JSONを表示／貼り付け"
        ></textarea>
        <p class="hint">
          通信対戦などで使う場合：
          自分の画面で「状態をJSONに出力」でコピー → 相手に送る →
          相手側で貼り付けて「JSONから状態を読み込み」。
        </p>
      </div>
      <div class="aiIO" style="display:none">
        <h3>AI 用テキスト表現</h3>
        <div class="aiIO-buttons">
          <button type="button">
            現在の状態からAI用テキストを生成
          </button>
        </div>
        <textarea
          rows="8"
          placeholder="ここにAIに渡すためのテキストが出力されます"
        />
        <p class="hint">
          ボタンを押すと、現在の手番プレイヤー視点で、
          盤面とゲーム状態を説明するテキストが生成されます。
          そのままコピーして LLM に渡せます。
        </p>
      </div>

      <div ref="turnOverlay" class="overlay hidden">
        <div class="overlayCard">
          <h2>交代</h2>
          <p ref="overlayText">プレイヤー2に交代します。準備ができたら「開始」を押してください。</p>
          <button class="primary" type="button" @click="hideOverlay">開始</button>
        </div>
      </div>

      <div v-if="clickDisabled" class="disabledShade">
        <div class="disabledMessage">
          {{locale == 'ja-JP'?'wait':'wait.'}}
        </div>
      </div>
    </section>
    <div v-else class="header">
      {{locale == 'ja-JP'?'ゲームセッションが終了したため盤面が無効です':'Board Disabled. Game session expired.'}}
      <!--
            <button class="CmdBtn" @click="restoreGame"> {{locale == 'ja-JP'?'ここからゲームを再開する':'Restore Game from here'}}</button>
      -->
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  type Coord, type GameSnapshot, inBounds,
  makeEmptyBoard,
  parseKey, type Phase, type PieceKey,
  PIECES,
  SIZE
} from "../Def";
import {
  allSunk, applyGameFromJSON,
  canPlace,
  currentAttacker,
  currentOpponent,
  currentPlacer,
  expandCells,
  gameState, getPlaceRule, isPlacementEnd,
  p1,
  p2, placePiece, randomFillForPlayer, receiveAttack,
} from "../mcp/rule-logic/logic";
import {App, type McpUiHostContext} from "@modelcontextprotocol/ext-apps";
// import * as e from "cors";

const app = ref<App | null>(null);
const baseApp = ref<HTMLElement | null>(null);
const hostContext = ref<McpUiHostContext | undefined>();
const gameDisabled = ref(false)
const clickDisabled = ref(false)
const gameSession = ref<string | undefined>(undefined)
const locale = ref('en')
const recentGameState = ref<GameSnapshot | null>(null);

// ====== DOM参照 ======
const ownBoardEl = ref<HTMLDivElement | null>(null);
const targetBoardEl = ref<HTMLDivElement | null>(null);
const turnOverlay = ref<HTMLDivElement | null>(null);
const overlayText = ref<HTMLParagraphElement | null>(null);
const phaseBadge = ref<HTMLDivElement | null>(null);
const currentPlayerLabel = ref<HTMLHeadingElement | null>(null);

const rotateBtnLabel = ref<string>('横向き');

// ====== 盤面データ (リアクティブ) ======
const coordFromIndex = (idx: number): Coord => ({ x: idx % SIZE, y: Math.floor(idx / SIZE) });

interface CellData {
  classes: string[];
}

const ownBoardCells = ref<CellData[]>([]);

const gameStateView = ref<GameSnapshot>(gameState);

const calcOwnBoardCells = () => {
  const cells: CellData[] = Array.from({ length: SIZE * SIZE }, () => ({ classes: [] }));

  const p = gameState.phase === 'battle' ? p1 : currentPlacer();

  // コマの配置を表示
  for (const piece of p.board.pieces) {
    for (const k of piece.cells) {
      const { x, y } = parseKey(k);
      const idx = y * SIZE + x;
      cells[idx].classes.push('ownPiece');
      if (piece.hits.includes(k)) {
        cells[idx].classes.push('hit');
      }
    }
  }

  // 攻撃結果を表示
  for (const [k, res] of Object.entries(p.board.attacks)) {
    const { x, y } = parseKey(k);
    const idx = y * SIZE + x;
    cells[idx].classes.push(res);
  }

  ownBoardCells.value = cells;
  return cells;
};

const targetBoardCells = ref<CellData[]>([]);

const calcTargetBoardCells = () => {
  const cells: CellData[] = Array.from({ length: SIZE * SIZE }, () => ({ classes: [] }));

  const target = gameState.phase === 'battle' ? p2 : { ...currentPlacer(), board: makeEmptyBoard() };

  // 攻撃結果のみを表示
  for (const [k, res] of Object.entries(target.board.attacks)) {
    const { x, y } = parseKey(k);
    const idx = y * SIZE + x;
    cells[idx].classes.push(res);
  }

  targetBoardCells.value = cells;
  return cells;
};

const inventoryItems =ref<Record<string, number>>({});

const setInventoryItems = () => {
  const p = gameState.phase === 'battle' ? currentAttacker() : currentPlacer();
  const items: Record<string, number> = {};
  for (const def of PIECES) {
    items[def.key] = p.inventory[def.key] ?? 0;
  }
  inventoryItems.value = items;
  return items;
}


function setPhaseUI(phase: Phase) {
  const placement = document.querySelector('.phaseOnlyPlacement') as HTMLElement;
  const battle = document.querySelector('.phaseOnlyBattle') as HTMLElement;
  if (phase === 'battle') {
    placement.classList.add('hidden');
    battle.classList.remove('hidden');
  } else {
    placement.classList.remove('hidden');
    battle.classList.add('hidden');
  }
}

function updateHeaders() {
  if (!phaseBadge.value || !currentPlayerLabel.value) return;
  if (gameState.phase === 'placementP1') {
    phaseBadge.value.textContent = '配置フェーズ: プレイヤー1';
    currentPlayerLabel.value.textContent = 'プレイヤー1';
  } else if (gameState.phase === 'placementP2') {
    phaseBadge.value.textContent = '配置フェーズ: プレイヤー2';
    currentPlayerLabel.value.textContent = 'プレイヤー2';
  } else {
    phaseBadge.value.textContent = `攻撃フェーズ: 手番は ${currentAttacker().name}`;
    currentPlayerLabel.value.textContent = currentAttacker().name;
  }
}

function renderAll() {
  updateHeaders();
  calcOwnBoardCells();
  calcTargetBoardCells()
}

// ====== イベントハンドラ ======
function handleRotate() {
  gameState.orientation = gameState.orientation === 'H' ? 'V' : 'H';
  rotateBtnLabel.value = gameState.orientation === 'H' ? '横向き' : '縦向き';
  gameStateView.value = gameState;
}

function handleInventoryClick(key: PieceKey) {
  gameState.selectedPieceKey = key;
  gameStateView.value.selectedPieceKey = key;
}

function handleOwnBoardMouseMove(e: MouseEvent) {
  if (gameState.phase === 'battle' || !gameState.selectedPieceKey || !ownBoardEl.value) return;
  const def = PIECES.find((d) => d.key === gameState.selectedPieceKey)!;
  const rect = ownBoardEl.value.getBoundingClientRect();
  const cellSize = ownBoardEl.value.clientWidth / SIZE;
  const x = Math.floor((e.clientX - rect.left - 6) / cellSize);
  const y = Math.floor((e.clientY - rect.top - 6) / cellSize);
  const cells = ownBoardEl.value.querySelectorAll<HTMLDivElement>('.cell');
  cells.forEach((c) => c.classList.remove('validPreview', 'invalidPreview'));
  if (!inBounds(x, y)) return;
  const ok = canPlace(currentPlacer().board, def.w, def.h, { x, y }, gameState.orientation);
  const marks = expandCells(def.w, def.h, { x, y }, gameState.orientation);
  for (const k of marks) {
    const { x: cx, y: cy } = parseKey(k);
    if (!inBounds(cx, cy)) continue;
    const idx = cy * SIZE + cx;
    cells[idx].classList.add(ok ? 'validPreview' : 'invalidPreview');
  }
}

function handleOwnBoardMouseLeave() {
  if (gameState.phase === 'battle' || !ownBoardEl.value) return;
  ownBoardEl.value.querySelectorAll('.cell').forEach((c) => c.classList.remove('validPreview', 'invalidPreview'));
}

function handleOwnBoardClick(idx: number) {
  if (gameState.phase === 'battle' || !gameState.selectedPieceKey) return;
  const def = PIECES.find((d) => d.key === gameState.selectedPieceKey)!;
  if ((currentPlacer().inventory[gameState.selectedPieceKey] ?? 0) <= 0) return;
  const origin = coordFromIndex(idx);
  if (!canPlace(currentPlacer().board, def.w, def.h, origin, gameState.orientation)) return;
  const placed = placePiece(currentPlacer().board, def.key, def.w, def.h, origin, gameState.orientation);
  currentPlacer().inventory[def.key] -= 1;
  gameState.placementHistory.push(placed);
  gameStateView.value.placementHistory = gameState.placementHistory;
  setInventoryItems()
  renderAll();
}

function handleUndo() {
  if (gameState.phase === 'battle') return;
  const last = gameState.placementHistory.pop();
  if (!last) return;
  const b = currentPlacer().board;
  b.pieces = b.pieces.filter((p) => p.id !== last.id);
  currentPlacer().inventory[last.key] += 1;
  gameStateView.value.placementHistory = gameState.placementHistory;
  setInventoryItems()
  renderAll();
}

async function handleLockIn() {
  const inv = currentPlacer().inventory;
  const left = Object.values(inv).reduce((a, b) => a + b, 0);
  if (left > 0) {
    showOverlay('すべてのコマを配置してください。');
    return;
  }
  try {
    if (!app.value) throw new Error('App not found')
  if (gameState.phase === 'placementP1') {
    console.log('player1 game state:', JSON.stringify(gameState, null, 2));
    clickDisabled.value = true
    const res = await app.value.callServerTool({
      name: "player1-placement", arguments: { state: gameState,gameSession:gameSession.value,locale:locale.value} });
    console.log('player1-placement result:', res)
  } else {
    gameState.phase = 'battle';
    gameState.currentPlayer = 1;
    setPhaseUI(gameState.phase);
    showOverlay('攻撃フェーズ開始。プレイヤー1のターンです。準備できたら開始。');
  }
  gameStateView.value = { ...gameState };
  renderAll();
      await app.value.sendMessage({
        role: "user",
        content: [{type:'text',text:setmessage()}]
      })
  } catch (e) {
    console.error('call error:', e)
  }

}

function handleRandomize() {
  if (gameState.phase === 'battle') return;
  const p = currentPlacer();
  randomFillForPlayer(p);
  gameState.placementHistory = [];
  gameStateView.value = { ...gameState };
  renderAll();
}

function showOverlay(text: string) {
  if (overlayText.value && turnOverlay.value) {
    overlayText.value.textContent = text;
    turnOverlay.value.classList.remove('hidden');
  }
}

function hideOverlay() {
  if (turnOverlay.value) turnOverlay.value.classList.add('hidden');
}

function handleTargetBoardClick(e: MouseEvent) {
  if (gameState.phase !== 'battle' || gameState.currentPlayer !== 1 || !targetBoardEl.value) return;
  const t = (e.target as HTMLElement).closest('.cell') as HTMLDivElement | null;
  if (!t) return;
  const idx = Number(t.dataset.index);
  const at = coordFromIndex(idx);
  const res = receiveAttack(currentOpponent().board, at);
  if (res === 'repeat') return;
  renderAll();
  clickDisabled.value = true
  targetBoardEl.value.style.pointerEvents = 'none';
  let resultMes = `プレイヤー1はプレイヤー2を攻撃した。 col=${at.x}, row=${at.y}. `;
  switch (res) {
    case 'hit':
      resultMes += ' 命中した! ';
      break;
    case 'miss':
      resultMes += ' 外れた. ';
      break;
  }
  setTimeout(async () => {
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
    gameState.seq += 1;
    setPhaseUI(gameState.phase);
    gameStateView.value = { ...gameState };
    try {
      if (!app.value) throw new Error('App not found')
      await app.value.callServerTool({
        name: "player1-attacked", arguments: { state: gameState,result:resultMes,gameSession:gameSession.value,locale:locale.value} });
      let mes = ''
      if (allSunk(currentOpponent().board)) {
        mes = `${currentAttacker().name} の勝ち！`
      } else {
        mes = `あなたの手番です。`
      }
      await app.value.sendMessage({
        role: "user",
        content: [{type:'text',text:`${resultMes} ${mes} get-boardのツールを呼び出して現在の盤面を確認してください。`}]
      })
    } catch (e) {
      console.error('call error:', e)
    }

    if (targetBoardEl.value) targetBoardEl.value.style.pointerEvents = '';
  }, 500);
}

function setmessage() {
  if (isPlacementEnd(p1) && isPlacementEnd(p2)) {
    return "戦闘開始。プレイヤー1のターン。プレイヤー2（アシスタント）はプレイヤー1（ユーザー）の行動を待ちます。get-boardのツールを呼び出して現在の盤面を確認してください。"
  } else if (isPlacementEnd(p1)) {
    return getPlaceRule()
  } else {
    return "プレイヤー1は駒を配置しなければなりません。プレイヤー1はプレイヤー1の駒の位置を指定しなければなりません。プレイヤー2（アシスタント）はプレイヤー1（ユーザー）が行動するまで待機します。"
  }
}

// ====== マウント ======
onMounted(async () => {
  const instance = new App({ name: "Submarine App", version: "1.0.0" },{},{autoResize:false});

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r') handleRotate();
  });

  instance.onteardown = async (params) => {
    console.info(`App is being torn down.${params}`);
    return {}
  }
  instance.ontoolinput = async (params) => {
    console.info("Received tool call input:", params);
  };
  instance.ontoolresult = async (result) => {
    console.info("Received tool call result:", result);
    if (result.structuredContent?.board) {
      applyGameFromJSON(result.structuredContent.board as unknown as GameSnapshot);
      gameStateView.value = { ...gameState };
      renderAll()
      recentGameState.value = result.structuredContent.board as unknown as GameSnapshot
    }
    if (!gameSession.value && result.structuredContent?.gameSession) {
      gameSession.value = result.structuredContent.gameSession as string
    }
    gameStateView.value = { ...gameState };
    if(gameSession.value && result.structuredContent?.gameSession) {
      if(gameSession.value === result.structuredContent?.gameSession) {
        gameDisabled.value = false
        clickDisabled.value = false
        return
      }
      console.log('Game session mismatch, disabling game')
      gameDisabled.value = true
      app.value?.sendSizeChanged({ height:50 });
    }
  };

  instance.ontoolcancelled = async (params) => {
    console.info("Tool call cancelled:", params.reason);
  };

  instance.onerror = console.error;

  instance.onhostcontextchanged = async (params) => {
    hostContext.value = { ...hostContext.value, ...params };
  };

  await instance.connect(undefined,{});
  app.value = instance;
  hostContext.value = instance.getHostContext();
  if (baseApp.value) {
    const { width, height } = baseApp.value?.getBoundingClientRect();
    console.log('width:', width, 'height:', height)
    app.value.sendSizeChanged({ height:Math.floor(height*1.2) });
  }
  locale.value = hostContext.value?.locale || 'en'

  setPhaseUI(gameState.phase);
  gameStateView.value = { ...gameState };
  setInventoryItems()
  renderAll();


});
</script>

<style scoped>
.layout {
  --bg: #0f172a;
  --fg: #e5e7eb;
  --accent: #38bdf8;
  --accent-2: #22d3ee;
  --hit: #ef4444;
  --miss: #94a3b8;
  --grid: #1f2937;
}

* {
  box-sizing: border-box
}

html, main {
  height: 100%
}

main {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif
}

header {
  padding: 16px 20px;
  border-bottom: 1px solid #1f2937;
  display: flex;
  gap: 16px;
  align-items: center
}

h1 {
  font-size: 20px;
  margin: 0
}

.badge {
  background: #111827;
  border: 1px solid #374151;
  color: #e5e7eb;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px
}

.layout {
  padding: 20px;
  display: flex;
  justify-content: center
}

.panel {
  max-width: 980px;
  width: 100%;
  position: relative
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: end;
  margin-bottom: 16px
}

.controls .group {
  display: flex;
  gap: 8px;
  align-items: center
}

.inventory {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap
}

.inventory .pieceBadge {
  border: 1px dashed #374151;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  display: flex;
  gap: 6px;
  align-items: center
}

.pieceIcon {
  display: inline-grid;
  gap: 2px;
  background: #0b1220;
  padding: 4px;
  border-radius: 6px;
  border: 1px solid #243042
}

.pieceIcon .sq {
  width: 10px;
  height: 10px;
  background: var(--accent)
}

button {
  background: #111827;
  color: var(--fg);
  border: 1px solid #334155;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer
}

button.primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #0b1220;
  border: none
}

button:disabled {
  opacity: .5;
  cursor: not-allowed
}

.boards {
  display: grid;
  grid-template-columns:1fr 1fr;
  gap: 24px
}

.boardWrap h3 {
  margin: 8px 0
}

.board {
  width: 100%;
  aspect-ratio: 1/1;
  background: #0b1220;
  border: 1px solid #243042;
  display: grid;
  grid-template-columns:repeat(7, 1fr);
  grid-template-rows:repeat(7, 1fr);
  gap: 2px;
  padding: 6px;
  border-radius: 12px
}


.cell {
  background: #0e1626;
  border: 1px solid var(--grid);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  user-select: none
}

.cell.ownPiece {
  background: #12233a;
  border-color: #184264;
  outline: 1px solid #1f6aa3
}

.cell.validPreview {
  outline: 2px dashed #22c55e
}

.cell.invalidPreview {
  outline: 2px dashed #ef4444
}

.cell.hit {
  background: var(--hit);
  border-color: #7f1d1d
}

.cell.miss {
  background: #0d1522;
  border-color: #334155;
  box-shadow: inset 0 0 0 3px var(--miss)
}

.hint {
  opacity: .7;
  font-size: 12px
}

.legend {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-top: 12px
}

.footerBtns {
  margin-top: 20px
}

.hidden {
  display: none !important
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, .92);
  display: grid;
  place-items: center
}

.overlayCard {
  background: #0b1220;
  border: 1px solid #243042;
  padding: 24px;
  border-radius: 16px;
  max-width: 420px;
  text-align: center
}

.disabledShade {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, .7);
  display: grid;
  place-items: center;
  cursor: not-allowed;
  z-index: 100
}

.disabledMessage {
  background: #0b1220;
  border: 1px solid #374151;
  padding: 24px;
  border-radius: 16px;
  color: var(--fg);
  font-size: 16px;
  text-align: center;
  max-width: 500px
}
</style>
