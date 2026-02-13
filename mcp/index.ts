import {McpAgent} from "agents/mcp";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {generateReversiHTMLFromState} from "./rule-logic/boardDrawer.js";
import {z} from "zod";
import {registerAppResource, registerAppTool, RESOURCE_MIME_TYPE} from "@modelcontextprotocol/ext-apps/server";
import {
  type CallToolResult,
  CallToolResultSchema,
  type ServerNotification,
  type ServerRequest
} from "@modelcontextprotocol/sdk/types.js";
import type {RequestHandlerExtra} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {State} from "../Def";
import {buildAiDescriptionForAiPlayer, gameState, gameToJSON, getGameRule} from "./rule-logic/logic.ts";


const resourceUri = "ui://submarine-mcp-app/game-board";
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
    }),

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
        return this.makeResponse('これはプレイヤー1が駒を配置する準備をしている状態です。プレイヤー1に駒を配置するよう指示してください。プレイヤー2はプレイヤー1の行動を待ってください。', true);
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
        return this.makeResponse(mes,true);
      },
    );
    registerAppTool(this.server,
      "player1-placement",
      {
        title: "player1 placement ships",
        description: "User move a stone. Do not use. The user moves the stone directly using other methods.",
        inputSchema: {
          move: z.string().describe('Where to place the black stone. Specify one of A1 to H8. Pass to PASS.'),
          gameSession: z.string().optional(),
          locale: z.string().optional(),
        },
        _meta: {}
      },
      ({move,gameSession,locale},_: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
        if (locale) {
          this.locale = locale;
        }
        if(this.state.gameSession !== gameSession)
          return this.makeMessage(this.lang('Game session mismatch. Please try again.', 'ゲームセッションが一致しません。もう一度お試しください。'))

        let m = '';
        // console.log('extra:',JSON.stringify(extra,null,2))
        try {
          const engine = new ReversiEngine()
          engine.import(this.state.board)
          const res = engine.playBlack(move)
          if (res.ok) {
            this.state.board = engine.export()
            this.setState({...this.state});
          } else {
            console.log('ng:', res.error)
            return this.makeMessage((move === "PASS" ?
              this.lang('User made an incorrect choice. Attempting to pass despite having a legal move','ユーザーは誤った選択をしました。合法的な動きがあるにもかかわらずパスしようとしています。')
              : this.lang('User made an incorrect choice. User tried to place ' + this.state.board.to + ' on ' + move,`ユーザーは間違った選択をしました。ユーザーは${move}へ${this.state.board.to === "W" ? '白石' : '黒石'}を置こうとしました。`))
              + '. error message is "' + res.error + '"')
          }
          const assistantTurn = this.lang(' Assistant\'s turn now. Next, Please devise a position for the next white stone and put a white stone by select-assistant(e.g., {"move":"A1"}).',
            'Assistantのターンです。次に白石を置く場所を設計し、select-assistantで白石を置くようにしてください（例：{"move":"A1"}）。')
          m = res.pass ?
              this.lang('User passed.','Userはパスしました。')+assistantTurn :
            res.reset ?
              this.lang('User reset the game. User\'s turn now.','Userはゲームをリセットしました。Userのターンです。') :
              this.lang('The user has already placed the next stone, so the board state has changed. User placed B on ' + move +'. ' +assistantTurn,
                `ユーザーは次の石をすでに置きました。盤面の状態は変更されました。ユーザーは${move}へ${this.state.board.to === "W" ? '白石' : '黒石'}を置きました。` +assistantTurn)
        } catch (e: any) {
          console.log('error:', e.toString())
          return {content: [{type: "text", text: `error: ${e.message}`, annotations: {audience: ["assistant"],}}]}
        }
        return this.makeMessage(`${m}\n${this.boardInfo()} ${this.noRepresents}`)
      }
    );
    registerAppTool(this.server,
      "select-assistant",
      {
        title: "Assistant move a stone",
        description: "Assistant move a stone and show the board to the user.",
        inputSchema: {
          move: z.string().describe('Where to place the white stone. Specify one of A1 to H8. Pass to PASS.'),
        },
        _meta: {
          ui: { resourceUri }
        }
      },
      ({move},_: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
        // console.log('extra:',JSON.stringify(extra,null,2))
        try {
          const engine = new ReversiEngine()
          engine.import(this.state.board)
          const res = engine.playWhite(move)
          if (res.ok) {
            this.state.board = engine.export()
            this.setState({...this.state});
          } else {
            console.log('ng:', res.error)
            return this.makeMessage(`${this.lang('The choice is incorrect.','選択誤りです。')} ${res.error}\n${this.boardInfo()} ${this.noRepresents}`)
          }
        } catch (e: any) {
          console.log('error:', e.toString())
          return {content: [{type: "text", text: `error: ${e.message}`, annotations: {audience: ["assistant"],}}]}
        }
        return this.makeMessage(`${this.lang('Board updated.')}\n${this.boardInfo()} ${this.noRepresents}`)
      }
    )
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

  }

  locale = 'en';

  private lang(message:string,messageJ?:string) {
    if(this.locale === 'ja-JP') {
      return messageJ || message;
    }
    return message;
  }

  private makeResponse(mes: string ,appendHtml=false) {
      const ret = {
        content: [
          {
            type: "text",
            text: mes + "\n--------\n" + buildAiDescriptionForAiPlayer(), //  ここでテキストで渡される盤面は常にAI視点 gameState.currentUser=2の盤面となる (本来はユーザにも表示してはいけない)
            annotations: {
              audience: ["assistant"],
            },
          }
        ]
      } as z.infer<typeof CallToolResultSchema>
      if (appendHtml) {
        const st = gameToJSON();
        //  ここで渡される盤面は常にユーザ視点の盤面 gameState.currentPlayer=1 の盤面になる
        console.log('gameState:', JSON.stringify(st,null,2))
        const body = renderToStaticMarkup(<Layout clientScript={clientScript.replace("= INIT_PATTERN",`= "${JSON.stringify(st).replace(/"/g, '\\"')}"`)} styleText={styleText}
        uiSize={postMessageUISizeChange}><Game/></Layout>);
        ret.content.push(createUIResource({
          uri: "ui://piece-attack/board",
          content: {type: 'rawHtml', htmlString: '<!DOCTYPE html>' + body},
          encoding: "text",
          resourceProps: {
            annotations: {
              audience: ["user"],
            },
          },
          adapters: {
            appsSdk: {
              enabled: false,
              config: {
                intentHandling: 'prompt',
                timeout: 30000
              }
            }
          }
        }))
      }
      // console.log('response:', JSON.stringify(ret,null,2))
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
