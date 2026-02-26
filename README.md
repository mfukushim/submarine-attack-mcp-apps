# Submarine attack for MCP Apps



English / [Japanese](./README_jp.md)  

> Migrating from https://github.com/mfukushim/reversi-mcp-ui.

This is a [submarine game](https://en.wikipedia.org/wiki/Battleship_(game)) by MCP Apps.

The game rules are similar to the grid attack in Nintendo's Wi-Fi Clubhouse Games (though 3x1 attacks are not yet included).  


**Game Rules**  
[mcp/rule-logic/gameRule.ts](mcp/rule-logic/gameRule.ts)

<img width="300" alt="image" src="./web_media/img.png" />  
<img width="400" alt="image" src="./web_media/img_1.png" />  
<img width="300" alt="image" src="./web_media/img_2.png" />  

The rules and board control of the submarine game are handled by MCP. The user plays as player 1 and the AI plays as player 2.  

## Available MCP clients

Currently, operation has been confirmed with Claude Desktop for Windows.  
Because it complies with the MCP Apps specifications, it is likely to work with MCP Apps-compatible clients.  
Operation has also been confirmed with the following MCP clients:  

- Avatar-Shell  https://github.com/mfukushim/avatar-shell

> Note: This MCP server outputs HTML data using the ui:// schema, one screen at a time, one move at a time. Depending on the MCP client's design, token consumption may be large.  
> When you first start using it, please check for unexpected token consumption.  

## Get started

#### Public Server

Submarine MCP Apps is built on the MCPAgent mechanism of CloudFlare AI Agent and supports Streamable-http connections.

A demo using Cloudflare workers is available below.

Please configure the following MCP settings on each MCP client.

- Claude Desktop(oauth required MCP client)
```json
{
  "mcpServers": {
    "submarine": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://submarine-attack-mcp-apps.daisycodes.workers.dev/mcp"
      ]
    }
  }
}
```

- MCP clients that do not require OAuth (Goose, Avatar-Shell, etc.)  
```json
{
  "mcpServers": {
    "submarine": {
      "type": "streamable-http",
      "url": "https://submarine-attack-mcp-apps.daisycodes.workers.dev/mcp"
    }
  }
}
```

(The public server may be shut down in the future.)  

#### Local Server  

You can run it as a local server by running wrangler locally.  

```shell
pnpm run dev # run wrangler local

or 

npm run dev # run wrangler local
````

Please configure the following MCP settings on each MCP client.  

```json
{
  "mcpServers": {
    "submarine": {
      "type": "streamable-http",
      "url": "http://localhost:8787/mcp"
    }
  }
}
```  

1. First, load the MCP resource GameRule to have the AI load the game rules.  
   <img width="300" alt="image" src="./web_media/img_3.png" />  
   Depending on the MCP client, the resource loading message may not appear. The AI ​​can play with general knowledge even without loading GameRule, but game progress may be unstable.  
2. Then, enter a prompt such as "Play Submarine" to start the game. The game will begin.  
3. First, arrange your pieces on the board. You can also arrange them automatically using the Random Arrange button. Once arrangement is complete, press the "Done" button.  
3. Depending on the MCP client, you may need to click a piece and press Enter to send a prompt in order for the game to proceed. When a prompt such as "press enter" appears, check the entered prompt and send it.  
4. Once you have finished placing your pieces, the AI will begin placing its pieces. Depending on the performance of the LLM, placement may not be successful in one try, so if the board state is still in player 2 placement mode, urge the AI to place by saying something like "Please place using player2-placement."  
5. Once placement is complete, you and the AI will take turns clicking on the opponent's board to attack. You may need to press Enter after clicking as the game progresses.  

## Tool Functions

#### tool functions

- new-game  
  Displays the initial game screen. If the game is in progress, it will force the initial screen.  
- get-board  
  The AI retrieves the game board. It is not displayed to the user. The retrieved board is only the AI's side of the board.  
  By specifying a token unknown to the AI, information about the user's side of the board can be obtained and used to update the HTML screen.  
- show-board  
  The AI retrieves the game board and displays it to the user. The AI sees the AI's side of the board, and the user sees the user's side of the board.  
- player1-placement  
  Player 1's piece placement. This tool is intended to be called by the board JS.  
- player2-placement  
  Player 2's piece placement. This tool is intended to be called by the AI's MCP.  
- player1-attack-position  
  Player 1's attack information. This tool is intended to be called by the board JS.  
- player2-attack-position  
  Player 2's attack information. This tool is intended to be called by the AI's MCP.  

#### Resource

- ui://submarine-mcp-apps/game-board  
  Board html+js (Vue rendering)  


## Program Structure

Game rules are processed within the MCP server. This means that the AI cannot directly intervene in the execution of the rules.
This prevents the AI from cheating according to the rules, which is a common occurrence with AI.


#### MCP handling

This client configuration is mostly compliant with @modelcontextprotocol/ext-apps.  
It has been extended to work with Cloudflare MCPAgent.  

## Local Debugging and Deployment

This mostly follows the instructions for running and debugging Cloudflare MCPAgent.  

```shell
pnpm install # install

pnpm run dev # start dev server

pnpm run inspector # start inspector

pnpm run deploy # deploy to cloudflare workers

```

## Guide (Japanese)  

