#!/usr/bin/env ts-node

import { webcrypto } from "node:crypto";
import { config } from "dotenv";
config();

import { v4 as uuidv4 } from "uuid";
import { A2AClient } from "@a2a-js/sdk/client";
import { PublicApiClient } from "./client/PublicApi.js";
import { HttpClient } from "../src/http/HttpClient.js";
import { createSigner } from "x402-fetch";
import { createX402Fetch } from "../src/http/x402Adapter.js";
import { OrchestrationManager } from "../src/orchestration/index.js";
import type { AgentCard, MessageSendParams } from "@a2a-js/sdk";
import readline from "readline";
import { extractText } from "./utils/extractText.js";

if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as unknown as Crypto;
}

const BASE_URL = process.env.END_POINT || "https://api.dgenai.io";
const API_KEY = process.env.API_KEY || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK = process.env.NETWORK || "solana";
const DEFAULT_MODE = process.env.MODE || "simple";

let api: PublicApiClient;
let client: A2AClient | null = null;
let signer: any = null;
let fetchImpl: typeof fetch = global.fetch;
let lastPaymentHeader: string | null = null;
let agentsCache: AgentCard[] = [];
let currentTaskId: string | undefined;
let selectedAgent: any = null;
let orchestrationManager: OrchestrationManager | null = null;
let mode: "simple" | "orchestration" = DEFAULT_MODE as any;

function createFetchWithHeaderCapture(baseFetch: typeof fetch): typeof fetch {
    return async (url: any, options?: any) => {
        const response = await baseFetch(url, options);
        const paymentHeader = response.headers.get("X-PAYMENT-RESPONSE");
        if (paymentHeader && paymentHeader !== lastPaymentHeader) {
            lastPaymentHeader = paymentHeader;
            console.log(`\n[PAYMENT] Proof updated: ${paymentHeader}\n`);
        }
        return response;
    };
}

async function initClient() {
    console.log("[INFO] Initializing A2A environment...");

    const http = new HttpClient({ apiKey: API_KEY, baseUrl: BASE_URL });

    if (PRIVATE_KEY && NETWORK) {
        signer = await createSigner(NETWORK, PRIVATE_KEY);
        const x402Fetch = createX402Fetch(signer);
        fetchImpl = createFetchWithHeaderCapture(x402Fetch);
        console.log(`[DGENAI] x402 signer initialized for ${NETWORK}`);
    } else {
        console.warn("[WARN] Missing PRIVATE_KEY or NETWORK → unsigned mode");
    }

    api = new PublicApiClient(http, signer, NETWORK, true, fetchImpl);

    orchestrationManager = new OrchestrationManager({
        llmProvider: { type: "openai", apiKey: process.env.OPENAI_KEY },
        apiClient: api,
    });

    console.log(`[READY] Connected to gateway: ${BASE_URL}`);
    console.log(`Current mode: ${mode}`);

    await preloadAgents();

    console.log("Type /list to see cached agents, /list refresh to refetch.");
    rl.setPrompt(`> [${mode}] `);
    rl.prompt();
}

async function preloadAgents() {
    console.log("[INFO] Fetching agents at startup...");
    try {
        agentsCache = await api.listAgents();
        console.log(`[INFO] Cached ${agentsCache.length} agents.`);
    } catch (err) {
        console.error("[ERROR] Failed to fetch agents on init:", err);
    }
}

async function listAgents(refresh = false) {
    if (refresh) {
        console.log("[INFO] Refreshing agent list...");
        await preloadAgents();
    }

    if (!agentsCache.length) {
        console.log("[WARN] No agents in cache. Try /list refresh.");
        return;
    }

    console.log(`\n[INFO] ${agentsCache.length} agents available:\n`);
    agentsCache.forEach((agent, i) => {
        console.log(`  [${i + 1}] ${agent.name}`);
        console.log(`       URL: ${agent.url}`);
        if (agent.description) console.log(`       Desc: ${agent.description}`);
        if (agent.capabilities)
            console.log(`       Capabilities: ${agent.capabilities}`);
        console.log("");
    });
    console.log("Use /use <index> to select an agent (simple mode only).");
}

async function useAgent(index: number) {
    const agent = agentsCache[index - 1];
    if (!agent) {
        console.log("[WARN] Invalid agent index.");
        return;
    }
    try {
        client = await A2AClient.fromCardUrl(agent.url, { fetchImpl });
        selectedAgent = agent;
        console.log(`[INFO] Selected agent: ${agent.name}`);
    } catch (err) {
        console.error("[ERROR] Failed to initialize agent:", err);
    }
}

async function sendMessage(messageText: string) {
    if (mode === "orchestration") {
        if (!orchestrationManager) {
            console.log("[WARN] Orchestration manager not initialized.");
            return;
        }
        console.log(`[INFO] Running orchestration for input: "${messageText}"`);
        const result = await orchestrationManager.run({
            userPrompt: messageText,
            availableAgents: agentsCache,
        });
        console.log("\n[RESULT]\n" + result);
        return;
    }

    if (!client || !selectedAgent) {
        console.log("[WARN] No agent selected. Use /list then /use <index>.");
        return;
    }

    const params: MessageSendParams = {
        message: {
            kind: "message",
            messageId: uuidv4(),
            role: "user",
            parts: [{ kind: "text", text: messageText }],
        },
    };

    console.log(`[INFO] Streaming message to ${selectedAgent.name}`);
    const stream = await client.sendMessageStream(params);

    for await (const chunk of stream) {
        switch (chunk.kind) {
            case "artifact-update":
                for (const part of chunk.artifact.parts ?? []) {
                    if (part.kind === "text" && part.text)
                        process.stdout.write(part.text);
                }
                break;
            case "status-update":
                process.stdout.write(
                    `\n\n[STATUS] ${chunk.status.state} ${extractText(chunk.status.message) ?? ""}\n`
                );
                break;
            case "task":
                currentTaskId = chunk.id;
                console.log(`\n[INFO] Task created: ${currentTaskId}`);
                break;
        }
    }

    console.log("\n[INFO] Stream ended.");
    currentTaskId = undefined;
}

async function cancelCurrentTask() {
    if (!client) {
        console.log("[WARN] No client initialized.");
        return;
    }
    if (!currentTaskId) {
        console.log("[WARN] No running task to cancel.");
        return;
    }
    try {
        await client.cancelTask({ id: currentTaskId });
        console.log(`[INFO] Task ${currentTaskId} cancelled.`);
        currentTaskId = undefined;
    } catch (err) {
        console.error("[ERROR] Failed to cancel task:", err);
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (trimmed === "") {
        rl.prompt();
        return;
    }

    if (trimmed.startsWith("/use ")) {
        const index = parseInt(trimmed.split(" ")[1], 10);
        if (!isNaN(index)) await useAgent(index);
        else console.log("Usage: /use <agent-index>");
    } else if (trimmed.startsWith("/list")) {
        const parts = trimmed.split(" ");
        const refresh = parts[1] === "refresh";
        await listAgents(refresh);
    } else {
        switch (trimmed) {
            case "/cancel":
                await cancelCurrentTask();
                break;
            case "/mode":
                mode = mode === "simple" ? "orchestration" : "simple";
                console.log(`[INFO] Mode switched to: ${mode}`);
                rl.setPrompt(`> [${mode}] `);
                break;
            case "/exit":
                console.log("[INFO] Exiting terminal.");
                process.exit(0);
            default:
                await sendMessage(trimmed);
        }
    }

    rl.prompt();
});

initClient();
