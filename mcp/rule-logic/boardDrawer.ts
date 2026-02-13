
// @ts-ignore cloudflare worker ではファイル読み込みができないのでwrangler設定で読ませる
import board from "./board.html";

export function generateReversiHTMLFromState(): string {
  return board
}
