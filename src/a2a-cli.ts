#!/usr/bin/env ts-node

import { Command } from "commander";
import { v4 as uuidv4 } from "uuid";
import { A2AClient } from "@a2a-js/sdk/client";
import { MessageSendParams, TaskIdParams } from "@a2a-js/sdk";
import readline from "readline";



if (process.argv.length < 3) {
    console.error("Usage: ts-node a2a-terminal.ts <agent-card-url>");
    process.exit(1);
}

const agentCardUrl = process.argv[2];
let currentTaskId: string | undefined; // store the running task id
let client: A2AClient;

// Initialize readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
});

async function initClient() {
    console.log("[INFO] Initializing A2A client...");
    client = await A2AClient.fromCardUrl(agentCardUrl);
    console.log("[INFO] Client ready. Type your message or /cancel to stop current task.");
    rl.prompt();
}

// Function to send a streaming message
async function sendMessageStream(messageText: string) {
    if (!client) return;

    const params: MessageSendParams = {
        message: {
            kind: "message",
            messageId: uuidv4(),
            role: "user",
            parts: [
                {
                    kind: "text",
                    text: messageText,
                    metadata: {
                        userWalletPubKey: "AYJk5Dzvu9MpSqmb6gX99jovcrr6Ss728B74qmErry6V",
                        isvirtualMode: false,
                    },
                },
            ],
        },
    };

    console.log(`[INFO] Streaming message: "${messageText}"`);

    try {
        const stream = await client.sendMessageStream(params);

        for await (const chunk of stream) {
            switch (chunk.kind) {
                case "artifact-update":
                    for (const part of chunk.artifact.parts ?? []) {
                        if (part.kind === "text" && part.text) {
                            process.stdout.write(part.text);
                        }
                    }
                    break;

                case "status-update":
                    process.stdout.write(
                        `\n[STATUS] ${chunk.status.state} ${chunk.status.message ?? ""}\n`
                    );
                    break;

                case "task":
                    currentTaskId = chunk.id;
                    console.log(`\n[INFO] Task created: ${currentTaskId}`);
                    break;

                default:
                    break;
            }
        }

        console.log("\n[INFO] Stream ended.");
        currentTaskId = undefined; // reset after stream ends
    } catch (err) {
        console.error("[ERROR] Streaming failed:", err);
        currentTaskId = undefined;
    }
}

// Function to cancel current task
async function cancelCurrentTask() {
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

// Readline input handling
rl.on("line", async (line) => {
    const trimmed = line.trim();

    if (trimmed === "") {
        rl.prompt();
        return;
    }

    if (trimmed === "/cancel") {
        await cancelCurrentTask();
    } else {
        await sendMessageStream(trimmed);
    }

    rl.prompt();
}).on("close", () => {
    console.log("\n[INFO] Exiting terminal.");
    process.exit(0);
});

// Start
initClient();
