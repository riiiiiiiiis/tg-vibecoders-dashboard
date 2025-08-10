### OpenAI Responses API: Structured Outputs (strict JSON Schema)

This project uses the Responses API as the only path to generate strictly valid JSON that matches our schema. Follow this minimal template to avoid 400s and parsing issues.

#### Env
- `OPENAI_API_KEY`: required
- `OPENAI_MODEL`: required (we do not change/override this in code)

#### Next.js runtime (server only)
In any API route that talks to OpenAI, pin Node runtime:

```ts
export const runtime = 'nodejs';
```

#### Minimal call (one path only)

```ts
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const response = await client.responses.create({
  model: process.env.OPENAI_MODEL!,
  instructions: 'Your system prompt here',
  input: 'Your user prompt here',
  text: {
    format: {
      type: 'json_schema',
      name: 'YourSchemaName',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['json', 'markdown'],
        properties: {
          json: { type: 'object' },
          markdown: { type: 'string' }
        }
      },
      strict: true
    }
  },
  // optional: cap output
  // max_output_tokens: 1200,
});

// High-level read; the SDK stitches content for you
const text = (response.output_text ?? '').trim();
if (!text) throw new Error('openai_empty_content');

// One parse of a single JSON payload
const parsed = JSON.parse(text);
```

Notes
- Do not use deprecated `response_format` at the top level. With openai@>=5, use `text.format` as above.
- We do not add retries or model fallbacks. Model is taken strictly from `OPENAI_MODEL`.

#### Error shape for UI (predictable)

On invalid JSON or schema violation, return 422 with `_request_id` (no retries):

```ts
try {
  // ...call + parse + validate
} catch (e: any) {
  const reqId = e?._request_id || e?.requestId || null;
  return NextResponse.json(
    { error: 'invalid_json', request_id: reqId },
    { status: 422 }
  );
}
```

#### Keep input small (avoid 400/413)

If sending big arrays (e.g., `messages`), trim to the latest N items before `responses.create`. This does not change the model or add retries; it only reduces payload size.

```ts
function trimArrayTail<T>(arr: T[] | undefined, max = 400): T[] | undefined {
  return Array.isArray(arr) ? arr.slice(-max) : arr;
}
```

#### Smoke test

You can verify a live call quickly:

```sh
node scripts/smoke-openai.mjs
```

It uses `OPENAI_API_KEY` and `OPENAI_MODEL` from `.env` and checks that the Responses call returns a single strict-JSON payload.


