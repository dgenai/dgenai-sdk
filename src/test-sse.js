import fetch from "node-fetch";
import { createParser } from "eventsource-parser";

const url = "http://localhost:5000/ACP/runs";

const payload = {
  agent_name: "3f556b4f-df88-4ddc-aabf-27a48f18161f",
  input: [
    {
      role: "User",
      parts: [
        {
          content_type: "text/plain",
          content: "hello",
          content_encoding: "plain"
        }
      ],
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    }
  ],
  mode: "stream"
};

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Accept": "text/event-stream",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  console.error("❌ Server returned:", response.status);
  process.exit(1);
}

console.log("✅ Connected to SSE stream");

const parser = createParser({
  
  onEvent: (event) => {
    console.log(event); 
    if (event.type === "event" || event.type === "message") {
      console.log("📩", event.data);
    }
  }
});

for await (const chunk of response.body) {
  const str = new TextDecoder().decode(chunk);
  parser.feed(str);
}
