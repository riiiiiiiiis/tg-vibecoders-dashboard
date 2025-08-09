import { PreviewType } from '../report/schema';
import { DailyDigest, DailyDigestSchema, DailyDigestJsonSchemaForLLM } from '../report/digest_schema';
import { SYSTEM_PROMPT, buildUserPrompt } from './shared';
import { renderDigest } from '../report/digest_render';

type GenerateArgs = {
  date: string;
  preview: PreviewType;
};

// moved to shared

// trimming logic moved to shared

// user prompt builder moved to shared

export async function generateReportFromPreview(args: GenerateArgs, timeoutMs = 120_000): Promise<{ json: DailyDigest; markdown: string }>{
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey) {
    throw new Error('missing_openai_key');
  }
  if (!model) {
    throw new Error('missing_openai_model');
  }

  const MAX_OUTPUT_TOKENS = Number.isFinite(Number.parseInt(process.env.REPORT_MAX_OUTPUT_TOKENS || '', 10))
    ? Number.parseInt(process.env.REPORT_MAX_OUTPUT_TOKENS as string, 10)
    : undefined;
  const EFFECTIVE_TIMEOUT = (typeof timeoutMs === 'number' && timeoutMs > 0)
    ? timeoutMs
    : (Number.parseInt(process.env.REPORT_TIMEOUT_MS || '', 10) || 120_000);

  const deadline = Date.now() + EFFECTIVE_TIMEOUT;

  async function runResponses(): Promise<{ parsed: any; requestId?: string }> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey });
    const body: any = {
      model,
      instructions: SYSTEM_PROMPT,
      input: buildUserPrompt(args.preview, args.date),
      text: {
        format: {
          type: 'json_schema',
          name: 'DailyLiveDigest',
          schema: DailyDigestJsonSchemaForLLM,
          strict: true,
        },
      },
    };
    if (typeof MAX_OUTPUT_TOKENS === 'number') body.max_output_tokens = MAX_OUTPUT_TOKENS;
    const op = client.responses.create(body);

    const remaining = Math.max(5_000, deadline - Date.now());
    const sdkRes: any = await Promise.race([
      op,
      new Promise((_, rej) => setTimeout(() => rej(new Error('openai_timeout')), remaining)),
    ]);

    const requestId = (sdkRes as any)?._request_id;
    const content = (typeof sdkRes?.output_text === 'string' ? sdkRes.output_text : '')?.trim();
    if (!content) {
      const err = new Error('openai_empty_content');
      (err as any).requestId = requestId;
      throw err;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e: any) {
      const snippet = content.slice(0, 400);
      const msg = `invalid_json_from_model: ${e?.message || 'parse_error'} | snippet: ${snippet}`;
      const error = new Error(msg);
      (error as any).statusCode = 422;
      (error as any).requestId = requestId;
      throw error;
    }
    return { parsed, requestId };
  }

  try {
    const { parsed, requestId } = await runResponses();
    const validated = DailyDigestSchema.safeParse(parsed);
    if (!validated.success) {
      const msg = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      const error = new Error(`json_schema_validation_failed: ${msg}`);
      (error as any).statusCode = 422;
      (error as any).requestId = requestId;
      throw error;
    }
    const md = renderDigest(validated.data as DailyDigest);
    return { json: validated.data as DailyDigest, markdown: md };
  } finally {
    // no-op
  }
}


