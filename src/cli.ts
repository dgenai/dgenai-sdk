#!/usr/bin/env node
import { Command } from "commander";
import { HttpClient } from "./http/HttpClient.js";
import { PublicApiClient } from "./client/PublicApi.js";

import { createSigner } from "x402-axios";

import { config } from "dotenv";

config();

const program = new Command();

program
  .name("dgenai")
  .description("Command-line interface for the dgenai Public API")
  .version("1.0.0");

function printError(err: unknown): void {
  if (err instanceof Error) console.error("Error:", err.message);
  else if (typeof err === "object" && err && "message" in err)
    console.error("Error:", (err as any).message);
  else console.error("Error:", String(err));
  process.exit(1);
}

async function createApi(key?: string) {
  const http = new HttpClient({
    apiKey: key,
  });

  let signer = undefined;
  if (process.env.PRIVATE_KEY && process.env.NETWORK) {
    signer = await createSigner(process.env.NETWORK, process.env.PRIVATE_KEY);
  }

  return new PublicApiClient(http, signer, process.env.NETWORK);
}

/** List agents */
program
  .command("agents-list")
  .description("List all available public agents")
  .option("-k, --key <key>", "API key (in-app wallet address)")
  .action(async (opts) => {
    try {
      const api = await createApi(opts.key);
      const agents = await api.listAgents();
      console.log(JSON.stringify(agents, null, 2));
    } catch (err) {
      printError(err);
    }
  });

/** askasync (agent-specific stream) */
program
  .command("ask-async")
  .description("Ask a specific agent asynchronously (emits status + message + done)")
  .requiredOption("-a, --agent <id>", "Agent ID")
  .requiredOption("-i, --input <text>", "Input text")
  .requiredOption("-n, --user <name>", "User name")
  .option("-u, --userid <id>", "Optional user ID")
  .option("-k, --key <key>", "API key (in-app wallet address)")
  .action(async (opts) => {
    const api = await createApi(opts.key);
    const body = { input: opts.input, userName: opts.user, userId: opts.userid };
    const emitter = api.askAgentAsyncStream(opts.agent, body);

    emitter
      .on("status", (msg) => console.error(`[status] ${msg}`))
      .on("message", (chunk) => process.stdout.write(chunk))
      .on("done", () => process.stdout.write("\n Done \n"))
      .on("error", (err) => printError(err));
  });

/** global askstreaming (event-based) */
program
  .command("ask-routedasync")
  .description("Ask using global event-based streaming (status + meta + message + done)")
  .requiredOption("-i, --input <text>", "Input text (required)")
  .requiredOption("-n, --user <name>", "User name (required)")
  .option("-u, --userid <id>", "Optional user ID")
  .option("-k, --key <key>", "API key (in-app wallet address)")
  .action(async (opts) => {
    const api = await createApi(opts.key);
    const body = { input: opts.input, userName: opts.user, userId: opts.userid };
    const emitter = api.askStreamingEmitter(body);

    emitter
      .on("status", (msg) => console.error(`[status] ${msg}`))
      .on("meta", (meta) =>
        console.error(`[meta] ${meta?.DisplayName || meta?.Name || "Unknown Agent"}`)
      )
      .on("message", (chunk) => process.stdout.write(chunk))
      .on("done", () => process.stdout.write("\n Done\n"))
      .on("error", (err) => printError(err));
  });

program.parse(process.argv);
