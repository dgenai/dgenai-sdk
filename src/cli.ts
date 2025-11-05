#!/usr/bin/env node
import { Command } from "commander";
import { HttpClient } from "./http/HttpClient.js";
import { PublicApiClient } from "./client/PublicApi.js";
import { createSigner } from "x402-fetch";        // ✅ from x402-fetch now
import { createX402Fetch } from "./http/x402Adapter.js"; // your adapter
import { config } from "dotenv";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto as unknown as Crypto;

config();

const program = new Command();

program.name("dgenai").description("CLI for dgenai Public API").version("2.0.0");

function printError(err: unknown): void {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}

async function initClient(key?: string, debug = false) {
  const http = new HttpClient({ apiKey: key });
  let signer: any;
  let fetchImpl: typeof fetch = globalThis.fetch;

  // signer and fetch both come from x402-fetch world
  if (process.env.PRIVATE_KEY && process.env.NETWORK) {
    signer = await createSigner(process.env.NETWORK, process.env.PRIVATE_KEY);
    fetchImpl = createX402Fetch(signer);
    console.log("lol");
  }

  return {
    api: new PublicApiClient(http, signer, process.env.NETWORK, debug, fetchImpl),
    signer,
  };
}

/** List agents */
program
  .command("agents-list")
  .action(async () => {
    try {
      const { api } = await initClient();
      console.log(JSON.stringify(await api.listAgents(), null, 2));
    } catch (err) {
      printError(err);
    }
  });

/** One-shot A2A */
program
  .command("ask")
  .requiredOption("-a, --agent <url>", "Agent card URL")
  .requiredOption("-i, --input <text>", "Input text")
  .action(async (opts) => {
    try {
      const { api } = await initClient();
      console.log(await api.askAgentSend(opts.agent, opts.input));
    } catch (err) {
      printError(err);
    }
  });

/** Streaming A2A */
program
  .command("ask-stream")
  .requiredOption("-a, --agent <url>", "Agent card URL")
  .requiredOption("-i, --input <text>", "Input text")
  .action(async (opts) => {
    try {
      const { api } = await initClient();
      const emitter = await api.askAgentStream(opts.agent, opts.input);
      emitter
        .on("message", (msg) => process.stdout.write(msg))
        .on("status", (msg) => console.error("[status]", msg))
        .on("done", () => console.log("\nDone"))
        .on("error", printError);
    } catch (err) {
      printError(err);
    }
  });

program.parse(process.argv);
