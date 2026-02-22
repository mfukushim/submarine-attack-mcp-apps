export const placeRule:string =
`
Player 1 has completed placing their pieces.
You are an AI player in a 7x7 submarine battleship-style game.
Your task now is to select the initial placement of Player 2's pieces.

Please strictly follow all rules and call the player2-placement tool with valid JSON.

Do not include descriptions, comments, or other text.

### Game Rules and Coordinate System

The board size is 7x7.

Coordinates are integers starting from 0.

x = 0..6 (left to right)

y = 0..6 (top to bottom)

(0,0) is the top-left cell.

### Pieces to Place (Specify Exactly)

You must place exactly 6 pieces.

1x1 x2

2x2 x1

2x1 x2

3x1 x1

Rectangular pieces can be placed horizontally or vertically.

### Placement Method (Method A)

Each piece is specified in the following format:

piece: "1x1" | "2x2" | "2x1" | "3x1"

x: Integer (X coordinate of anchor)

y: Integer (Y coordinate of anchor)

o: Orientation (H or V) (omitted for 1x1 and 2x2)

The anchor (x,y) is the top-left cell of the piece.

### Constraints (All Constraints Must Be Met)

All occupied cells must be within the 7x7 board.

Pieces must not overlap.

Each piece must be placed as many times as necessary.

The orientation must be "H" or "V" as appropriate.

Duplicate pieces are not allowed.

### Output Format (Strict)

Only the following JSON structure is output.

{
"placements": [
{
"piece": "1x1",
"x": 0,
"y": 0
}
]
}

Placements must be an array of exactly 6 objects.

Do not add extra fields.

Do not add comments.

Do not include text outside of the JSON.

### Strategy Guidance (Optional but Allowed)

You are free to choose any valid placement strategy.
(e.g., concentrated placement, dispersed placement, edge-focused placement, random placement).
You do not need to explain the intent of your strategy.
`

export const placeRuleJp:string =
`
プレイヤー1がコマの配置を完了しました。
あなたは7×7の潜水艦戦艦スタイルのゲームのAIプレイヤーです。
今のあなたの任務は、プレイヤー2の駒の初期配置を選択することです。

すべてのルールに厳密に従い、有効なJSONを使って player2-placement のツールを呼び出してください。。

説明、コメント、その他のテキストを含めないでください。

### ゲームルールと座標系

ボードのサイズは7×7です。

座標は0から始まる整数です。

x = 0..6 (左から右)

y = 0..6 (上から下)

(0,0) は左上のセルです。

### 配置する駒（正確に指定してください）

6個の駒を正確に配置する必要があります。

1x1 ×2

2x2 ×1

2x1 ×2

3x1 ×1

長方形の駒は、水平または垂直に配置できます。

### 配置方法 (A 方式)

各ピースは以下の形式で指定します。

piece: 「1x1」 | 「2x2」 | 「2x1」 | 「3x1」のいずれか

x: 整数 (アンカーの X 座標)

y: 整数 (アンカーの Y 座標)

o: 方向 (H または V) (1x1 および 2x2 の場合は省略)

アンカー (x,y) はピースの左上のセルです。

### 制約（すべて満たす必要があります）

すべての占有セルは7×7のボード内に収まっている必要があります

ピースは重なり合ってはなりません

各ピースは必要な数だけ配置する必要があります

必要に応じて、向きは「H」または「V」にする必要があります

重複したピースは許可されません

### 出力形式（厳密）

以下のJSON構造のみを出力します。

{
"placements": [
{
"piece": "1x1",
"x": 0,
"y": 0
}
]
}

placementsは、正確に6個のオブジェクトの配列である必要があります

余分なフィールドを追加しないでください

コメントを追加しないでください

JSONの外側にテキストを含めないでください

### 戦略ガイダンス（任意ですが許可されています）

有効な配置戦略を自由に選択できます
（例：集中配置、分散配置、端に集中配置、ランダム配置）。
戦略の意図を説明する必要はありません。
`
