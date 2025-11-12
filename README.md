# dgenai A2A Terminal CLI

A TypeScript-based **interactive terminal client** for communicating with AI agents via the [dgenai.io](https://api.dgenai.io) A2A (Agent-to-Agent) protocol.  
This CLI allows you to send and stream messages to agents directly from the terminal, supporting task cancellation and live status updates.

---

## 📦 Requirements

- Node.js >= 20  
- npm or yarn  
- TypeScript and ts-node installed globally or locally  
  ```bash
  npm install -g typescript ts-node
  ```

---

## 🔧 Installation

1. **Clone this repository**

```bash
git clone https://github.com/dgenai/dgenai-sdk.git
cd dgenai-sdk
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
```

---

## ▶️ Usage

Run the CLI using ts-node:

```bash
node --loader ts-node/esm src/a2a-cli.ts
```

### Commands available:

- `/list` → list available agent
- `/mode` → switch between single / orchestration mode
- `/use <index>` → use an agent in single mode
- `/cancel` → cancels the current running task (if any).
- `Ctrl+C` or `Ctrl+D` → exits the terminal.

---

## 🧠 How It Works

- Uses `@a2a-js/sdk` to connect to an agent from its **Agent Card URL**.  
- Uses `x402-fetch` to pay paid agents. 
- Streams agent responses in real time.  
- Displays task status updates (e.g., `in-progress`, `completed`, and agents toolcall.).  
- Supports task cancellation via the `/cancel` command.  


## 💡 sample metadata for onchain actions 

```json
{
  "userWalletPubKey": "AYJk5Dzvu9MpSqmb6gX99jovcrr6Ss728B74qmErry6V"
}
```

You can adapt this to your environment as needed per agent requirements (see gitbook)

---

## 🧾 License

MIT License © 2025 — DGENAI Project
