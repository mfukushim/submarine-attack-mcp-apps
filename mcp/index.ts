import {McpAgent} from "agents/mcp";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {generateReversiHTMLFromState} from "./rule-logic/boardDrawer.js";
import {z} from "zod";
import {registerAppResource, registerAppTool, RESOURCE_MIME_TYPE} from "@modelcontextprotocol/ext-apps/server";
import {
  type CallToolResult,
  type ServerNotification,
  type ServerRequest
} from "@modelcontextprotocol/sdk/types.js";
import type {RequestHandlerExtra} from "@modelcontextprotocol/sdk/shared/protocol.js";
import {type GameSnapshot, GameSnapshotSchema, type State} from "../Def";
import {
  allSunk,
  applyGameFromJSON, applyPlacementsToPlayer,
  buildAiDescriptionForAiPlayer,
  gameState,
  gameToJSON,
  getGameRule, getPlaceRule, isPlacementEnd, p1, p2, playerToJSON, receiveAttack, setToBattle, validatePlacementSpec
} from "./rule-logic/logic.ts";


const resourceUri = "ui://submarine-mcp-apps/game-board";
// Define our MCP agent with tools
export class MyMCP extends McpAgent<Env, State, {}> {
  server = new McpServer({
    name: "Submarine attack Game",
    version: "2.0.0",
    description: "Submarine attack Game",
  });

  initialState: State = {
    board: gameToJSON(),
    gameSession: crypto.randomUUID(),
    currentSeq: 0,
  };

  async onStateUpdate(state: State) {
    console.log("state updated", state);
  }

  // boardInfo() {
  //   return this.lang(
  //     `current board: ${JSON.stringify(this.state.board)}.\n${this.state.board.to === "W" ? 'Assistant\'s turn. Use select-assistant to place the pieces.' : 'User\'s turn. Wait for the user\'s choice.'}`,
  //   `現在の盤面: ${JSON.stringify(this.state.board)}\n${this.state.board.to === "W" ? 'Assistantの番です。select-assistantを使ってコマを置いてください。' : 'Userの番です。ユーザの選択を待ってください。'}`)
  // }

  // noRepresents = this.lang('The board has already been presented to the user, so the assistant does not need to re-present it.',
  //   '盤面はすでにユーザーに提示されているため、アシスタントが再度提示する必要はありません。')

  async init() {
    this.server.registerResource("GameRule","file:///game-rule",{
      title:"Submarine Game Rule",
      description:"description of game rule",
      mimeType:"text/plain"
    },() => {
      return {
        contents:[{
          uri:"file:///game-rule",
          mimeType:"text/plain",
          text: getGameRule()
        }
        ]
      }
    });

    registerAppResource(this.server,'game-board',resourceUri,{
      mimeType: RESOURCE_MIME_TYPE
    },async () => {
      return {
        contents: [{
          uri: resourceUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: generateReversiHTMLFromState()
        }]
      }
    })

    registerAppTool(this.server,
      "view-log",
      {
        title: "Test for debug",
        description: "Test for debug,do not use",
        inputSchema: {
          text: z.string().optional(),
        },
        _meta: { ui: { resourceUri: resourceUri } }
      },
      ({text}) => {
        console.log(`##${text}`)
        return {
          content: [{
            type: "text",
            text: 'done',
            annotations: {
              audience: ['user'],
            },
          }]
        }
      },
    );

    registerAppTool(this.server,
      "new-game",
      {
        title: "Start a new Submarine attack game",
        description: "Start a new Submarine attack game and show the board to the user.",
        inputSchema: {},
        _meta: { ui: { resourceUri: resourceUri } }
      },
      () => {
        return this.makeResponse(this.lang('This is the state where Player 1 is preparing to place his piece. Instruct Player 1 to place his piece. Player 2 should wait for Player 1 to act.',
          'これはプレイヤー1が駒を配置する準備をしている状態です。プレイヤー1に駒を配置するよう指示してください。プレイヤー2はプレイヤー1の行動を待ってください。'));
      });
    registerAppTool(this.server,
      "get-board",
      {
        title: "Get the current board state",
        description: "Get the current board state.",
        _meta: {
          ui: { }
        }
      },
      (_: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
        let mes = ''
        //  TODO gameStateはここのboardからとってこないといけないのでは?
        switch (gameState.currentPlayer) {
          case 1:
            mes = "プレイヤー1のターンです。プレイヤー2はプレイヤー1が行動するのを待つ必要があります。"
            break;
          case 2:
            mes = "プレイヤー2のターン。player2-attack-positionを使ってOPPONENT_BOARDの位置にショットを発射してください。row=0 から 6。col=0 から 6"
            break
        }
        return this.makeResponse(mes);
      },
    );
    registerAppTool(this.server,
      "player1-placement",
      {
        title: "player1 placement ships",
        description: "User move a stone. Do not use. The user moves the stone directly using other methods.",
        inputSchema: {
          state: z.any().describe('Game state from player1'),
          gameSession: z.string().optional(),
          locale: z.string().optional(),
        },
        _meta: {}
      },
      ({state,locale}) => {
        console.log('p1 place:',state,locale)
        if (locale) {
          this.locale = locale;
        }

        if (gameState.phase === "battle") {
          return {content: [{type: "text", text: `ゲーム状態は戦闘です。配置を設定できません`, annotations: {audience: ["assistant"],}}]}
        }
        const st = GameSnapshotSchema.safeParse(state)
        if(!st.success) {
          return {content: [{type: "text", text: `解析エラー。プレイヤー2はプレイヤー1の駒を配置できません。`, annotations: {audience: ["assistant"],}}]}
        }
        const nextGameState = st.data;
        console.log('receive gameState:',JSON.stringify(nextGameState))
        try {
          //  TODO 厳格には届いたnextGameStateが妥当に設定されているかベリファイがいる
          applyGameFromJSON(nextGameState)
          this.setState({...this.state,board:nextGameState});
          return this.setGameState();
          //  TODO 今は仮にAI側盤面は自動生成にする
          // randomFillForPlayer(p2)
          // lockAiBoard()
        } catch (e: any) {
          console.log('error:', e.toString())
          return {content: [{type: "text", text: `error: ${e.message}`, annotations: {audience: ["assistant"],}}]}
        }
      }
    );
    registerAppTool(this.server,
      "player2-placement",
      {
        title: "Player2 set placement ships",
        description: "Player2 placement all ships",
        inputSchema: {
          placements: z.array(z.object({
            piece: z.enum(["1x1", "2x2", "2x1", "3x1"]).describe('piece type'),
            x: z.number().int().min(0).max(6).describe('fire column position'),
            y: z.number().int().min(0).max(6).describe('fire row position'),
            o: z.enum(["H", "V"]).optional().describe('orientation of piece. orientation "H" or "V" (omit for 1x1 and 2x2)')
          })).describe('player2 placement ships'),
          // gameSession: z.string().optional(), //  TODO 通信時に使用
        },
        _meta: {
          ui: { resourceUri }
        }
      },
      ({placements}) => {

        try {
          const validatedPlacements = validatePlacementSpec(placements);
          if(!validatedPlacements.ok) {
            return {content: [{type: "text", text: `プレイヤー2の配置が失敗した: ${validatedPlacements.errors.join('\n')} 修正して、再びplayer2-placementを呼び出してください。`, annotations: {audience: ["assistant"],}}]}
          }
          applyPlacementsToPlayer(p2, placements)
          // const gameState = state as GameSnapshot
          console.log('make ai board:',JSON.stringify(p2))
          this.state.board.p2 = p2
          const res = this.setGameState();

          console.log('current:',JSON.stringify(this.state))
          this.setState({board:gameState,gameSession:this.state.gameSession,currentSeq:this.state.currentSeq});
          return res
          // applyGameFromJSON(gameState)
          // randomFillForPlayer(p2)
          // setToBattle()
        } catch (e: any) {
          console.log('error:', e.toString())
          return {content: [{type: "text", text: `error: ${e.message}`, annotations: {audience: ["assistant"],}}]}
        }
        // const mes = "player1's Turn. The Player1 must specify the attack position. row=0 to 6. col=0 to 6. Player2 should wait for player1 to act."
        // // const mes = "Assistant's Turn. Shot fire to OPPONENT_BOARD position. row=0 to 6. col=0 to 6"
        // return this.makeResponse(mes,true);
      }
    );
    registerAppTool(this.server,
      "player1-attacked",
      {
        title: "player1's attacked result",
        description: "player1 attacks and sets the results.",
        inputSchema: {
          //  TODO stateがよいか x,yがよいか
          state: z.any().describe('Game state from Player1'),
          result: z.string().describe('player1 attack result. hit or miss'),
          // x: z.number().int().min(0).max(6).describe('fire column position'),
          // y: z.number().int().min(0).max(6).describe('fire row position'),
          // gameSession: z.string().optional(), //  TODO 通信時に使用
          gameSession: z.string().optional(),
          locale: z.string().optional(),
        },
        _meta: {}
      },
      ({state,result}) => {
        //  TODO 現在の保持しているターンと照合する ロジック的にはこちらはまだユーザ状態
        //  TODO ゲームステートの判定は最終的にはこちらでやらないといけない。
        const gameState = state as GameSnapshot
        console.log('receive gameState:',JSON.stringify(gameState))
        this.setState({...this.state,board:gameState});
        try {
          applyGameFromJSON(gameState)
        } catch (e: any) {
          console.log('error:', e.toString())
          return {content: [{type: "text", text: `error: ${e.message}`, annotations: {audience: ["assistant"],}}]}
        }
        if(allSunk(p2.board)) {
          //  AIの勝利
          return this.makeResponse(result+" プレイヤー2の勝利です! Game End.");
        }
        let mes = ''
        switch (gameState.currentPlayer) {
          case 1:
            mes = result+" プレイヤー1のターンです。プレイヤー2はプレイヤー1の行動を待つ必要があります。"
            break;
          case 2:
            mes = result+" プレイヤー2のターン開始。player2-attack-positionを使ってOPPONENT_BOARD の位置にショットを発射してください。row=0 から 6。col=0 から 6"
            break
        }
        return this.makeResponse(mes);
      }
    );
    registerAppTool(this.server,
      "player2-attack-position",
      {
        title: "Player2 attacking position",
        description: "The player2 will designate the attack position on the opponent's board.",
        inputSchema: {
          x: z.number().int().min(0).max(6).describe('fire column position'),
          y: z.number().int().min(0).max(6).describe('fire row position'),
          // gameSession: z.string().optional(),
          // locale: z.string().optional(),
        },
        _meta: {}
      },
      ({x,y}) => {
        //  手番間違いチェック
        if(gameState.currentPlayer!==2) {
          return this.makeResponse("プレイヤー1のターンです。プレイヤー2は攻撃することはできません。プレイヤー2（アシスタント）はプレイヤー1（ユーザー）が行動するまで待機する必要があります。");
        }

        const res = receiveAttack(p1.board, {x,y});
        gameState.p1 = playerToJSON(p1) //  p1に結果が反映されるのでgameState側に移す
        //  操作と結果をアニメ再生するためのイベントも追加する
        gameState.motion =  {
          posX: x,
          posY: y,
          hit: false,
          aiWin: false,
        };

        if(allSunk(p1.board)) {
          //  AIの勝利
          gameState.currentPlayer = 1;  //  実行後のターンを変える
          gameState.motion.aiWin = true;
          gameState.motion.hit = true;
          return this.makeResponse("プレイヤー1の勝利です! Game End.");
        }
        let mes = "プレイヤー2の攻撃は失敗しました。プレイヤー1のターンです。プレイヤー2（アシスタント）はプレイヤー1（ユーザー）が行動するまで待機する必要があります。現状の双方の攻撃状態を短く評価してプレイヤー1を軽くあおってください。"
        switch (res) {
          case "repeat":
            mes = "この位置は既に射撃済みです。OPPONENT_BOARD_KNOWLEDGEの状態を確認して、もう一度射撃してください。player2-attack-positionを使って再び射撃してください。row=0～6、col=0～6"
            break
          case "hit":
            mes = "プレイヤー2の攻撃が命中しました。プレイヤー1のターンです。プレイヤー2（アシスタント）はプレイヤー1（ユーザー）が行動するまで待機します。現状の双方の攻撃状態を短く評価してプレイヤー1を軽くあおってください。"
            gameState.currentPlayer = 1;  //  実行後のターンを変える
            gameState.motion.hit = true;
            break
          default:
            gameState.currentPlayer = 1;  //  実行後のターンを変える
            break
        }
        return this.makeResponse(mes);
      }
    );

/*
    registerAppTool(this.server,
      "restore-game",
      {
        title: "Restore game",
        description: "Restore a game from a previous state and show the board to the user. Do not use.",
        inputSchema: {
          state: z.any().describe('Game board state.'),
          gameSession: z.string().optional(),
        },
        _meta: { resourceUri }
      },
      ({state,gameSession},_: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
        const stateInner = state as ExportState
        try {
          const engine = new ReversiEngine()
          engine.import(stateInner)
          this.setState({board:{...stateInner},gameSession:gameSession || this.state.gameSession,currentSeq:stateInner.seq})
        } catch (e: any) {
          console.log('error:', e.toString())
        }

        return this.makeMessage(`${this.lang('Game is restart.')}\n${this.boardInfo()} ${this.noRepresents}`)
      }
    );
*/

  }

  locale = 'en';

  private lang(message:string,messageJ?:string) {
    if(this.locale === 'ja-JP') {
      return messageJ || message;
    }
    return message;
  }

  private setGameState() {
    if (isPlacementEnd(p1) && isPlacementEnd(p2)) {
      console.log('state is battle. start battle.')
      setToBattle()
      const mes = "戦闘開始。プレイヤー1のターン。プレイヤー2（アシスタント）はプレイヤー1（ユーザー）の行動を待ちます。"
      return this.makeResponse(mes);
    } else if (isPlacementEnd(p1)) {
      console.log('state is placement. 1 ok 2 ng.')
      return {
        content: [
          {
            type: "text",
            text: getPlaceRule(),
            annotations: {
              audience: ["assistant"],
            },
          }
        ],
        structuredContent: this.state as any
      } as CallToolResult
    } else {
      console.log('state is placement. 1 ng 2 ng.')
      const mes = "プレイヤー1は駒を配置しなければなりません。プレイヤー1はプレイヤー1の駒の位置を指定しなければなりません。プレイヤー2（アシスタント）はプレイヤー1（ユーザー）が行動するまで待機します。"
      // const mes = "Assistant's Turn. Shot fire to OPPONENT_BOARD position. row=0 to 6. col=0 to 6"
      return {
        content: [
          {
            type: "text",
            text: mes,
            annotations: {
              audience: ["assistant"],
            },
          }
        ],
        structuredContent: this.state as any
      } as CallToolResult
    }
  }

  private makeResponse(mes: string ) {
      const ret:CallToolResult = {
        content: [
          {
            type: "text",
            text: mes + "\n--------\n" + buildAiDescriptionForAiPlayer(), //  ここでテキストで渡される盤面は常にAI視点 gameState.currentUser=2の盤面となる (本来はユーザにも表示してはいけない)
            annotations: {
              audience: ["assistant"],
            },
          }
        ],
        structuredContent: this.state as any
      }// as z.infer<typeof CallToolResultSchema>
      return ret;
    }

}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      return MyMCP.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("Not found", {status: 404});
  },
};
