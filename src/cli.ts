#!/usr/bin/env node
import { Command } from "commander";
import { HttpClient } from "./http/HttpClient.js";
import { PublicApiClient } from "./client/PublicApi.js";
import { createSigner } from "x402-axios";
import { config } from "dotenv";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as unknown as Crypto;
}

config();

/** ============================================================================
 * CLI PROGRAM SETUP
 * ============================================================================
 */
const program = new Command();

program
  .name("dgenai")
  .description("Command-line interface for the dgenai Public API")
  .version("1.1.1");

/** ============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================
 */

/** Get ISO-style timestamp for log formatting */
function timestamp() {
  return new Date().toISOString().split("T")[1].replace("Z", "");
}

/** Colored terminal log helpers (used when debug is enabled) */
const log = {
  info: (...args: any[]) => console.log(`\x1b[36m[${timestamp()}] [INFO]\x1b[0m`, ...args),
  debug: (...args: any[]) => console.log(`\x1b[90m[${timestamp()}] [DEBUG]\x1b[0m`, ...args),
  warn: (...args: any[]) => console.warn(`\x1b[33m[${timestamp()}] [WARN]\x1b[0m`, ...args),
  error: (...args: any[]) => console.error(`\x1b[31m[${timestamp()}] [ERROR]\x1b[0m`, ...args),
};

/** Print error and exit */
function printError(err: unknown): void {
  if (err instanceof Error) console.error("Error:", err.message);
  else if (typeof err === "object" && err && "message" in err)
    console.error("Error:", (err as any).message);
  else console.error("Error:", String(err));
  process.exit(1);
}

/** ============================================================================
 * CLIENT INITIALIZATION
 * ============================================================================
 */

/**
 * Initializes the HttpClient and PublicApiClient instances.
 * - Loads optional signer from environment (.env)
 * - Enables x402 payment support if signer is configured
 * - Enables optional debug logs
 */
async function initClient(key?: string, debug = false) {
  if (debug) log.info("Initializing HTTP client...");

  const http = new HttpClient({
    apiKey: key,
    baseUrl: "http://localhost:5000",
  });

  let signer: any = undefined;

  // Attempt to load signer from environment variables
  if (process.env.PRIVATE_KEY && process.env.NETWORK) {
    try {
      signer = await createSigner(process.env.NETWORK, process.env.PRIVATE_KEY);
      if (debug) log.info("Signer initialized successfully (network:", process.env.NETWORK, ")");
    } catch (err) {
      if (debug) log.error("Failed to create signer:", err);
    }
  } else if (debug) {
    log.warn("No signer found in environment (.env missing PRIVATE_KEY or NETWORK)");
  }

  const api = new PublicApiClient(http, signer, process.env.NETWORK, debug);
  if (debug) log.info("PublicApiClient initialized.");

  return { api, signer };
}

/** ============================================================================
 * COMMANDS
 * ============================================================================
 */

/** List available public agents */
program
  .command("agents-list")
  .description("List all available public agents")
  .option("-k, --key <key>", "API key (in-app wallet address)")
  .option("-d, --debug", "Enable debug logging")
  .action(async (opts) => {
    try {
      const { api } = await initClient(opts.key, opts.debug);
      if (opts.debug) log.info("Fetching list of public agents...");
      const agents = await api.listAgents();
      console.log(JSON.stringify(agents, null, 2));
    } catch (err) {
      printError(err);
    }
  });

/** Ask a specific agent asynchronously (event-based streaming) */
program
  .command("ask-async")
  .description("Ask a specific agent asynchronously (emits status, message, done)")
  .requiredOption("-a, --agent <id>", "Agent ID")
  .requiredOption("-i, --input <text>", "Input text")
  .requiredOption("-n, --user <name>", "User name")
  .option("-u, --userid <id>", "Optional user ID")
  .option("-k, --key <key>", "API key (in-app wallet address)")
  .option("-d, --debug", "Enable debug logging")
  .action(async (opts) => {
    const { api } = await initClient(opts.key, opts.debug);

    if (opts.debug)
      log.info(`Sending async request to agent '${opts.agent}' as '${opts.user}'`);

    const body = {
      input: opts.input,
      userName: opts.user,
      userId: opts.userid,
      feePayer: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4",
    };

    const emitter = api.askAgentAsyncStream(opts.agent, body);

    emitter
      .on("status", (msg) => console.error(`\x1b[33m[status]\x1b[0m ${msg}`))
      .on("message", (chunk) => process.stdout.write(chunk))
      .on("done", () => {
        process.stdout.write("\n\x1b[32mDone\x1b[0m\n");
        if (opts.debug) log.info("Async stream completed.");
      })
      .on("error", (err) => printError(err));
  });

/** Ask using the global routed async streaming endpoint */
program
  .command("ask-routedasync")
  .description("Ask using the global event-based streaming (status, meta, message, done)")
  .requiredOption("-i, --input <text>", "Input text (required)")
  .requiredOption("-n, --user <name>", "User name (required)")
  .option("-u, --userid <id>", "Optional user ID")
  .option("-k, --key <key>", "API key (in-app wallet address)")
  .option("-d, --debug", "Enable debug logging")
  .action(async (opts) => {
    const { api } = await initClient(opts.key, opts.debug);

    if (opts.debug)
      log.info(`Sending routed async request from user '${opts.user}'`);

    const body = {
      input: opts.input,
      userName: opts.user,
      userId: opts.userid,
      feePayer: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4",
    };

    const emitter = api.askStreamingEmitter(body);

    emitter
      .on("status", (msg) => console.error(`\x1b[33m[status]\x1b[0m ${msg}`))
      .on("meta", (meta) => {
        const name = meta?.DisplayName || meta?.Name || "Unknown Agent";
        console.error(`\x1b[35m[meta]\x1b[0m ${name}`);
      })
      .on("message", (chunk) => process.stdout.write(chunk))
      .on("done", () => {
        process.stdout.write("\n\x1b[32mDone\x1b[0m\n");
        if (opts.debug) log.info("Routed streaming session completed.");
      })
      .on("error", (err) => printError(err));
  });

/** ============================================================================
 * EXECUTION
 * ============================================================================
 */
program.parse(process.argv);
