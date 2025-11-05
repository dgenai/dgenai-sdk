# dgenai A2A Terminal CLI

A TypeScript-based **interactive terminal client** for communicating with AI agents via the [dgenai.io](https://api.dgenai.io) A2A (Agent-to-Agent) protocol.  
This CLI allows you to send and stream messages to agents directly from the terminal, supporting task cancellation and live status updates.

---

## 📦 Requirements

- Node.js >= 18  
- npm or yarn  
- TypeScript and ts-node installed globally or locally  
  ```bash
  npm install -g typescript ts-node
  ```

---

## 🔧 Installation

1. **Clone this repository**

```bash
git clone https://github.com/dgenai/a2a-terminal.git
cd a2a-terminal
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
ts-node a2a-terminal.ts <agent-card-url>
```

Example:

```bash
ts-node a2a-terminal.ts https://api.dgenai.io/agents/example-agent/<id>/.well-known/agent-card.json

Once connected, you can type messages directly into the terminal.

### Commands available:

- Type any text → sends it as a message to the agent.
- `/cancel` → cancels the current running task (if any).
- `Ctrl+C` or `Ctrl+D` → exits the terminal.

---

## 🧠 How It Works

- Uses `@a2a-js/sdk` to connect to an agent from its **Agent Card URL**.  
- Streams agent responses in real time.  
- Displays task status updates (e.g., `in-progress`, `completed`, etc.).  
- Supports task cancellation via the `/cancel` command.  

Example interaction:

```
[INFO] Initializing A2A client...
[INFO] Client ready. Type your message or /cancel to stop current task.
> hello agent
[INFO] Streaming message: "hello agent"
The agent replies in real-time...
[STATUS] in-progress generating
[STATUS] completed
[INFO] Stream ended.
```

---

## ⚙️ Code Overview

- `a2a-terminal.ts` — main entry point.  
- Uses:
  - `A2AClient` from `@a2a-js/sdk/client`  
  - `uuid` for message IDs  
  - `readline` for terminal input/output  
- Each message is sent as a structured `MessageSendParams` object with text and metadata.  
- Active task IDs are tracked to enable `/cancel`.

---

## 💡 Example Metadata Sent

```json
{
  "userWalletPubKey": "AYJk5Dzvu9MpSqmb6gX99jovcrr6Ss728B74qmErry6V",
  "isvirtualMode": false
}
```

You can adapt this to your environment as needed per agent requirements

---

## 🧩 Development

To build and run locally:

```bash
npm run build
node dist/a2a-terminal.js <agent-card-url>
```

To run directly in dev mode:

```bash
ts-node a2a-terminal.ts <agent-card-url>
```

---

## 🧾 License

MIT License © 2025 — DGENAI Project
