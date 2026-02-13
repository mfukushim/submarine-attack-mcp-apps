# Simple Reversi for MCP Apps



English / [Japanese](./README_jp.md)  

> Migrating from https://github.com/mfukushim/reversi-mcp-ui.

> Reversi was available on Goose MCP client  

This is a simple Reversi game that uses MCP Apps.
You can control your turn (fixed to black) by clicking on the screen.

However, its greatest feature is that **"the rules of Reversi are decided by the MCP, making it difficult for the AI to cheat the rules of the game."**

Because Reversi is simple, AI rarely cheats the game rules, but it's known that AI often cheats when playing more complex games.

In this MCP server, the game rules are handled by the MCP, making it difficult for AI to cheat (Note: There are currently some limitations).

The structure is relatively simple, so we believe it can be used as a reference for creating similar board games.

<img width="400" alt="image" src="./blog_media/img.png" />

## Available MCP clients

Currently, we have confirmed that it works with Claude Desktop for Windows.  
Since it complies with the MCP Apps specifications, it is likely to work with clients that support MCP Apps.  

> reversi works with Goose MCP client.
> It also works experimentally with Avatar-Shell  


> Note: This MCP server outputs HTML data using the ui:// schema for each screen and each move. When you first start using it, please check for unexpected token consumption.  


## Get started

#### Public Server

Reversi MCP Apps is built on the MCPAgent mechanism of CloudFlare AI Agent and supports Streamable-http connections.

A demo using Cloudflare workers is available below.

Please configure the following MCP settings on each MCP client.

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

After successfully connecting Reversi, you can start playing by clicking "Play Reversi".  
Depending on the AI's performance, you may also need to instruct the user to "It is your turn to play white pieces and place them in the best position."

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
    "reversi": {
      "type": "streamable-http",
      "url": "http://localhost:8787/mcp"
    }
  }
}
```  

> Note: Starting wrangler seems to result in an error within a Docker container.  

## Tool Functions and UI Actions

#### tool functions

- new-game  
  Displays the initial game screen. If the game is in progress, the initial screen will be displayed.
- get-board  
  Get the Reversi board. When you first run it, the initial game screen will be displayed.
- select-user  
  Places the black stone (user turn). Coordinates are specified from A1 to H8. If there is no choice but to pass the turn, call it with PASS. To end/reset the game, call it with NEW.
  In environments where UI Actions are implemented, you can play the game without using them. In that case, if you configure the MCP client so that the select-user tool function cannot be called, the AI will not be able to control the user turn.
- select-assistant  
  Place the white stone (AI turn). The coordinates are A1-H8. If you have no choice but to pass your turn, call it with PASS.
- restore-game  
  Restoring a suspended game (currently being adjusted)

#### Resource

- ui://reversi-mcp-ui/game-board  
  Board html+js (Vue rendering)  


## Program Structure

Reversi rules are processed within the MCP server. This means that the AI cannot directly intervene in the execution of the rules.
This prevents the AI from cheating according to the rules, which is a common occurrence with AI.
> Note  
> In the current specifications, strictly speaking, AI may interfere with the rules in the following cases:
> - The AI may call the tool (select-user) on the user's turn without permission.
> - The AI may be able to read the user's moves during their turn (this is not an issue in Reversi, but it is necessary to take measures in games where you hide your moves or cards).
>

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

