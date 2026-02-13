<template>
  <main class="layout">
    <section class="panel">
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
          <div ref="inventoryEl" class="inventory" />
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
          <div ref="ownBoardEl" class="board" data-board="own" />
          <small class="hint">配置フェーズ: 盤面をクリックしてコマを置く</small>
        </div>
        <div class="boardWrap">
          <h3>相手の盤面(攻撃用)</h3>
          <div ref="targetBoardEl" class="board" data-board="target" />
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
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import {
  BoardState, cloneInventory,
  Coord, GameSnapshot,
  inBounds,
  keyOf,
  makeEmptyBoard,
  Orientation,
  parseKey, Phase,
  PieceKey, PIECES,
  PlacedPiece,
  PlayerState, SIZE
} from "../Def";
import {
  allSunk,
  canPlace,
  currentAttacker,
  currentOpponent,
  currentPlacer,
  expandCells,
  gameState, gameToJSON,
  p1,
  p2, placePiece, randomFillForPlayer, receiveAttack
} from "../mcp/rule-logic/logic";



// ====== DOM参照 ======
const ownBoardEl = ref<HTMLDivElement | null>(null);
const targetBoardEl = ref<HTMLDivElement | null>(null);
const inventoryEl = ref<HTMLDivElement | null>(null);
const turnOverlay = ref<HTMLDivElement | null>(null);
const overlayText = ref<HTMLParagraphElement | null>(null);
const phaseBadge = ref<HTMLDivElement | null>(null);
const currentPlayerLabel = ref<HTMLHeadingElement | null>(null);

const rotateBtnLabel = ref<string>('横向き');

// ====== 盤面レンダリング ======
function clearBoardDOM(el: HTMLDivElement) {
  el.innerHTML = '';
  for (let i = 0; i < SIZE * SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = String(i);
    el.appendChild(cell);
  }
}

const coordFromIndex = (idx: number): Coord => ({ x: idx % SIZE, y: Math.floor(idx / SIZE) });

function renderOwnBoard(p: PlayerState) {
  if (!ownBoardEl.value) return;
  const cells = ownBoardEl.value.querySelectorAll<HTMLDivElement>('.cell');
  cells.forEach((c) => {
    c.className = 'cell';
  });
  for (const piece of p.board.pieces)
    for (const k of piece.cells) {
      const { x, y } = parseKey(k);
      const idx = y * SIZE + x;
      const el = cells[idx];
      el.classList.add('ownPiece');
      if (piece.hits.includes(k)) el.classList.add('hit');
    }
  for (const [k, res] of Object.entries(p.board.attacks)) {
    const { x, y } = parseKey(k);
    const idx = y * SIZE + x;
    cells[idx].classList.add(res);
  }
}

function renderTargetBoard(target: PlayerState) {
  if (!targetBoardEl.value) return;
  const cells = targetBoardEl.value.querySelectorAll<HTMLDivElement>('.cell');
  cells.forEach((c) => {
    c.className = 'cell';
  });
  for (const [k, res] of Object.entries(target.board.attacks)) {
    const { x, y } = parseKey(k);
    const idx = y * SIZE + x;
    cells[idx].classList.add(res);
  }
}

function renderInventory(p: PlayerState, selectedKey: string | null) {
  if (!inventoryEl.value) return;
  inventoryEl.value.innerHTML = '';
  for (const def of PIECES) {
    const left = p.inventory[def.key] ?? 0;
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'pieceBadge';
    badge.dataset.key = def.key;
    if (left === 0) badge.disabled = true;
    if (selectedKey === def.key) badge.classList.add('primary');
    const icon = document.createElement('span');
    icon.className = 'pieceIcon';
    icon.style.gridTemplateColumns = `repeat(${def.w}, auto)`;
    icon.style.gridTemplateRows = `repeat(${def.h}, auto)`;
    for (let y = 0; y < def.h; y++)
      for (let x = 0; x < def.w; x++) {
        const sq = document.createElement('span');
        sq.className = 'sq';
        icon.appendChild(sq);
      }
    const txt = document.createElement('span');
    txt.textContent = `${def.label}（残:${left}）`;
    badge.appendChild(icon);
    badge.appendChild(txt);
    inventoryEl.value.appendChild(badge);
  }
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
  if (gameState.phase === 'battle') {
    renderOwnBoard(p1);
    renderTargetBoard(p2);
  } else {
    renderOwnBoard(currentPlacer());
    renderTargetBoard({ ...currentPlacer(), board: makeEmptyBoard() });
  }
  renderInventory(gameState.phase === 'battle' ? currentAttacker() : currentPlacer(), gameState.selectedPieceKey);
}

// ====== イベントハンドラ ======
function handleRotate() {
  gameState.orientation = gameState.orientation === 'H' ? 'V' : 'H';
  rotateBtnLabel.value = gameState.orientation === 'H' ? '横向き' : '縦向き';
}

function handleInventoryClick(e: MouseEvent) {
  const t = (e.target as HTMLElement).closest('button[data-key]') as HTMLButtonElement | null;
  if (!t) return;
  gameState.selectedPieceKey = t.dataset.key ?? null;
  renderInventory(gameState.phase === 'battle' ? currentAttacker() : currentPlacer(), gameState.selectedPieceKey);
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

function handleOwnBoardClick(e: MouseEvent) {
  if (gameState.phase === 'battle' || !gameState.selectedPieceKey) return;
  const def = PIECES.find((d) => d.key === gameState.selectedPieceKey)!;
  if ((currentPlacer().inventory[gameState.selectedPieceKey] ?? 0) <= 0) return;
  const t = (e.target as HTMLElement).closest('.cell') as HTMLDivElement | null;
  if (!t) return;
  const idx = Number(t.dataset.index);
  const origin = coordFromIndex(idx);
  if (!canPlace(currentPlacer().board, def.w, def.h, origin, gameState.orientation)) return;
  const placed = placePiece(currentPlacer().board, def.key, def.w, def.h, origin, gameState.orientation);
  currentPlacer().inventory[def.key] -= 1;
  gameState.placementHistory.push(placed);
  renderAll();
}

function handleUndo() {
  if (gameState.phase === 'battle') return;
  const last = gameState.placementHistory.pop();
  if (!last) return;
  const b = currentPlacer().board;
  b.pieces = b.pieces.filter((p) => p.id !== last.id);
  currentPlacer().inventory[last.key] += 1;
  renderAll();
}

function handleLockIn() {
  const inv = currentPlacer().inventory;
  const left = Object.values(inv).reduce((a, b) => a + b, 0);
  if (left > 0) {
    showOverlay('すべてのコマを配置してください。');
    return;
  }
  if (gameState.phase === 'placementP1') {
    gameState.phase = 'placementP2';
    gameState.placementHistory = [];
    gameState.selectedPieceKey = '1x1';
    gameState.orientation = 'H';
    const state = gameToJSON();
    console.log('player1 game state:', JSON.stringify(state, null, 2));
    window.parent.postMessage(
      {
        type: 'tool',
        payload: {
          toolName: 'player1-placement',
          params: { state },
        },
      },
      '*'
    );
  } else {
    gameState.phase = 'battle';
    gameState.currentPlayer = 1;
    setPhaseUI(gameState.phase);
    showOverlay('攻撃フェーズ開始。プレイヤー1のターンです。準備できたら開始。');
  }
  renderAll();
}

function handleRandomize() {
  if (gameState.phase === 'battle') return;
  const p = currentPlacer();
  randomFillForPlayer(p);
  gameState.placementHistory = [];
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
  if (allSunk(currentOpponent().board)) {
    setTimeout(() => {
      window.parent.postMessage(
        {
          type: 'notify',
          payload: {
            message: `${currentAttacker().name} の勝ち！`,
          },
        },
        '*'
      );
    }, 400);
    return;
  }
  targetBoardEl.value.style.pointerEvents = 'none';
  let resultMes = `プレイヤー1はプレイヤー2を攻撃した。 col=${at.x}, row=${at.y}. `;
  switch (res) {
    case 'hit':
      resultMes += ' 命中! ';
      break;
    case 'miss':
      resultMes += ' 外れた. ';
      break;
  }
  setTimeout(() => {
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
    setPhaseUI(gameState.phase);
    const state = gameToJSON();
    window.parent.postMessage(
      {
        type: 'tool',
        payload: {
          toolName: 'player1-attacked',
          params: {
            state,
            result: resultMes,
          },
        },
      },
      '*'
    );
    if (targetBoardEl.value) targetBoardEl.value.style.pointerEvents = '';
  }, 2000);
}


// ====== マウント ======
onMounted(() => {
  if (ownBoardEl.value) {
    clearBoardDOM(ownBoardEl.value);
    ownBoardEl.value.addEventListener('mousemove', handleOwnBoardMouseMove);
    ownBoardEl.value.addEventListener('mouseleave', handleOwnBoardMouseLeave);
    ownBoardEl.value.addEventListener('click', handleOwnBoardClick);
  }
  if (targetBoardEl.value) {
    clearBoardDOM(targetBoardEl.value);
    targetBoardEl.value.addEventListener('click', handleTargetBoardClick);
  }
  if (inventoryEl.value) {
    inventoryEl.value.addEventListener('click', handleInventoryClick);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r') handleRotate();
  });

  setPhaseUI(gameState.phase);
  renderAll();
});
</script>

<style scoped>
:root { --bg:#0f172a; --fg:#e5e7eb; --accent:#38bdf8; --accent-2:#22d3ee; --hit:#ef4444; --miss:#94a3b8; --grid:#1f2937; }
*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Noto Sans JP,sans-serif}
header{padding:16px 20px;border-bottom:1px solid #1f2937;display:flex;gap:16px;align-items:center}
h1{font-size:20px;margin:0}.badge{background:#111827;border:1px solid #374151;color:#e5e7eb;padding:4px 10px;border-radius:999px;font-size:12px}
.layout{padding:20px;display:flex;justify-content:center}.panel{max-width:980px;width:100%}
.controls{display:flex;flex-wrap:wrap;gap:16px;align-items:end;margin-bottom:16px}.controls .group{display:flex;gap:8px;align-items:center}
.inventory{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.inventory .pieceBadge{border:1px dashed #374151;padding:4px 8px;border-radius:8px;font-size:12px;display:flex;gap:6px;align-items:center}
.pieceIcon{display:inline-grid;gap:2px;background:#0b1220;padding:4px;border-radius:6px;border:1px solid #243042}.pieceIcon .sq{width:10px;height:10px;background:var(--accent)}
button{background:#111827;color:var(--fg);border:1px solid #334155;padding:8px 12px;border-radius:10px;cursor:pointer}button.primary{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#0b1220;border:none}button:disabled{opacity:.5;cursor:not-allowed}
.boards{display:grid;grid-template-columns:1fr 1fr;gap:24px}.boardWrap h3{margin:8px 0}
.board{width:min(90vw,420px);aspect-ratio:1/1;background:#0b1220;border:1px solid #243042;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(7,1fr);gap:2px;padding:6px;border-radius:12px}
.cell{background:#0e1626;border:1px solid var(--grid);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;user-select:none}
.cell.ownPiece{background:#12233a;border-color:#184264;outline:1px solid #1f6aa3}
.cell.validPreview{outline:2px dashed #22c55e}.cell.invalidPreview{outline:2px dashed #ef4444}
.cell.hit{background:var(--hit);border-color:#7f1d1d}.cell.miss{background:#0d1522;border-color:#334155;box-shadow:inset 0 0 0 3px var(--miss)}
.hint{opacity:.7;font-size:12px}.legend{display:flex;gap:16px;align-items:center;margin-top:12px}.footerBtns{margin-top:20px}.hidden{display:none !important}
.overlay{position:fixed;inset:0;background:rgba(2,6,23,.92);display:grid;place-items:center}.overlayCard{background:#0b1220;border:1px solid #243042;padding:24px;border-radius:16px;max-width:420px;text-align:center}
</style>
