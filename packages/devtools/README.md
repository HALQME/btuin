# @btuin/devtools

Development tools for btuin.

## Installation

```bash
bun add -d @btuin/devtools
```

## Profiler

The devtools package includes performance profilers:

```typescript
import { profileLayout } from "@btuin/devtools/profiler";

// Profile layout performance
const results = await profileLayout({
  iterations: 1000,
  componentCount: 100,
});

console.log(`Average render time: ${results.averageMs}ms`);
```

## Log Streaming

Stream console output to files or TCP:

```typescript
import { createJsonlFileLogStreamer } from "@btuin/devtools/stream";

const streamer = createJsonlFileLogStreamer("./logs/app.jsonl");
```
