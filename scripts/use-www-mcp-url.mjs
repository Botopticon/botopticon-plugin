import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { WORKING_MCP_URL } from "./validate-plugin.mjs";

const file = process.argv[2] ?? new URL("../mcp.json", import.meta.url);
const mcp = JSON.parse(readFileSync(file, "utf8"));
mcp.mcpServers.botopticon.url = WORKING_MCP_URL;
writeFileSync(file, `${JSON.stringify(mcp, null, 2)}\n`);
