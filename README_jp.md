# リバーシ MCP Apps


Japanese / [English](./README.md)

> https://github.com/mfukushim/reversi-mcp-ui からマイグレーション中です。

自分の手番(黒固定)を画面上のクリックで操作できます。  

ですが、最大の特徴は **「リバーシのルールを裁定するのはMCPが行っているため、AIがゲームのルールをズルすることが困難」** な点です。  

リバーシは単純なのでAIがゲームルールのズルをすることはほとんどありませんが、複雑なゲームを行う場合はAIはズルをすることがよくあることは知られています。  
このMCPサーバーではゲームルールはMCPが処理するためAIはズルを行うことが困難です(注意: 現状いくつか制約があります)  

TypeScriptの比較的シンプルな構成にしているので、同様のボードゲームも参考にして作ることが出来ると考えます。  

<img width="400" alt="image" src="./blog_media/img.png" />


## 動作するMCPクライアント  

現時点 Claude Desktop for Windowsでの動作を確認しています。  
MCP Appsの仕様に準拠しているため、MCP Apps対応クライアントでは動く可能性が高いです。  
Avatar-Shellも近日中にMCP Appsに対応予定です。  

> 注意 このMCPサーバーはui:// スキーマによるhtmlデータを一画面、一手ごとに出力します。 使い始め時は想定外のトークン消費がないか確認してください。

## はじめかた 

#### 公開サーバー

リバーシMCP Appsは、CloudFlare AI Agent のMCPAgentの仕組みの上で作られており、Streamable-http接続に対応しています。  

Cloudflare workersでのデモを以下で公開しています。  

各MCPクライアントで以下のMCP設定を行ってください。  

```json
{
  "mcpServers": {
    "reversi": {
      "type": "streamable-http",
      "url": "https://reversi-mcp-apps.daisycodes.workers.dev/mcp"
    }
  }
}
```
> 注意: wrangler起動はDocker container内ではエラーになるようです。  

正常にreversiを接続後、「リバーシをプレイしてください」で実行可能です。  

(公開サーバーは状況によっては停止するかもしれません)

#### ローカルサーバー

wranglerのローカル実行でローカルサーバーとして起動できます。

```shell
pnpm run dev # run wrangler local

or 

npm run dev # run wrangler local
````

各MCPクライアントで以下のMCP設定を行ってください。

```json
{
  "mcpServers": {
    "reversi": {
      "type": "streamable-http",
      "url": "http://localhost:8787/mcp"
    }
  }
}
```

## tool関数とUI Actions

#### tool functions

- new-game  
  ゲーム初期画面を表示します。ゲーム途中の場合は強制的に初期画面にします。
- get-board  
  リバーシ盤面を取得する。最初に実行時はゲーム初期画面を表示します。
- select-user  
  黒石(ユーザ手番)の石を配置します。座標はA1～H8で指定します。手番をパスするしかないときは PASS で呼び出します。ゲームを終わらせる/リセットする場合は NEW で呼び出します。  
  UI Actionsが実装されている環境では使わずにゲームできます。その場合MCPクライアントでselect-userのtool関数を呼び出せない設定にすればAIがユーザ手番を操作できません。    
- select-assistant  
  白石(AI手番)の石を配置します。座標はA1-H8で指定します。手番をパスするしかないときは PASS で呼び出します。
- restore-game  
  中断したゲームを復元します(調整中)


#### Resource

- ui://reversi-mcp-ui/game-board  
  盤面html+js (Vueレンダリング)  


## プログラム構成  

MCPサーバー内でリバーシのルール処理を実行します。このためルールの実行にAIは直接介入できません。  
これにより、AIでよく起きる「AIがルール上のズルをする」ことを抑止してゲームが出来ます。  

> 注意  
> 現在の仕様として、厳格には次のケースでAIがルールに干渉することがあります。  
> - AIがユーザの手番のtool (select-user) を勝手に呼び出してしまう可能性
> - AIがユーザの手番の操作を読み取ってしまう可能性 (リバーシでは問題になりませんが、打つ手や手札を隠すゲームなどでは対策要)  
> 



#### MCP処理部

ほぼ @modelcontextprotocol/ext-apps に準拠したクライアント構成です。  
Cloudflare MCPAgent での動作するように拡張しています。  

## ローカルデバッグとデプロイ

ほぼCloudflare MCPAgentの実行とデバッグに従います。  

```shell
pnpm install # install

pnpm run dev # start dev server

pnpm run inspector # start inspector

pnpm run deploy # deploy to cloudflare workers

```

## ガイド  

