# dgenai-sdk

**Official TypeScript SDK for the DGENAI Public API**

The `dgenai-sdk` provides a modern, fully typed interface to interact with the [DGENAI Public API](https://api.dgenai.io).  
It includes native support for **x402 micropayments**, **agent streaming**, and **event-based message handling** — making it ideal for developers building integrations, bots, or advanced AI tools on top of DGENAI.

---

## 🚀 Features

- Fully typed TypeScript SDK  
- Built-in **x402** payment interceptor  
- Supports **real-time streaming** (async and routed modes)  
- Integrated **CLI tool** (`dgenai`)  
- Debug-friendly with colored logs  
- Lightweight, dependency-free core  

---

## 📦 Installation

```bash
npm install dgenai-sdk
# or
yarn add dgenai-sdk
```

---

## 🧠 Quick Start (SDK)

```typescript
import { PublicApiClient, HttpClient } from "dgenai-sdk";
import { createSigner } from "x402-axios";


signer = await createSigner(NETWORK, PRIVATE_KEY);
const client = new PublicApiClient(http, signer, NETWORK);

// Ask an agent asynchronously (event-based)
const emitter = client.askAgentAsyncStream("agent-id", {
  input: "Explain Solana smart contracts",
  userName: "DeveloperX",
});

emitter.on("message", (chunk) => process.stdout.write(chunk));
emitter.on("status", (msg) => console.error(`[status] ${msg}`));
emitter.on("done", () => console.log("✅ Done"));
```

---

## 💻 CLI Usage

Once installed globally or via `npx`, you can use the built-in CLI:

```bash
npx dgenai agents-list
```

### Commands

#### `agents-list`
List all available public agents.

```bash
dgenai agents-list
```

#### `ask-async`
Send a message to a specific agent and stream results in real-time.

```bash
dgenai ask-async \
  --agent "agent-id" \
  --input "Generate a Solidity smart contract" \
  --user "DeveloperX"
```

#### `ask-routedasync`
Ask via the global routed endpoint (auto-selects the right agent).

```bash
dgenai ask-routedasync \
  --input "Summarize today's crypto trends" \
  --user "AnalystY"
```

Each stream emits:
- `status` → progress updates  
- `meta` → metadata (agent name, type, etc.)  
- `message` → main text output  
- `done` → end of stream  

---

## 🔐 Payments (x402 Integration)

If your requests require payment, simply set a signer via environment variables:

```bash
PRIVATE_KEY=your_private_key
NETWORK=solana
```

The SDK automatically uses [`x402-axios`](https://www.npmjs.com/package/x402-axios) to handle signed micropayments and confirmation headers.

---

## ⚙️ Debugging

Enable debug mode via environment variable or CLI flag:

```bash
DEBUG_X402=true dgenai ask-async ...
```

This logs:
- All outgoing requests  
- x402 payment responses  
- Streaming event data  

---

## 🧩 TypeScript Support

The SDK ships with full typings and `index.d.ts` definitions.  
You can directly import and use types like `Ask`, `AgentListResponse`, and `TextChunkHandler`.

---

## 🪪 License

MIT © DGENAI
