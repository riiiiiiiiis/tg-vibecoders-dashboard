import { z } from 'zod';

// Zod schema for the new DailyDigest shape
// Matches the Output Format in the requirements
const DiscussionItemSchema = z.object({
  topic: z.string(),
  question: z.string(),
  participants: z.array(z.string()),
  outcome: z.string(),
});

export const DailyDigestSchema = z.object({
  discussions: z.array(DiscussionItemSchema),
  resources: z.array(z.string()),
  unanswered_questions: z.array(z.string()),
  // Keep known required stats and allow extra numeric fields from source data
  stats: z
    .object({
      messages_count: z.number().int(),
      participants_count: z.number().int(),
    })
    .passthrough(),
  insights: z.array(z.string()).optional(),
});

export type DailyDigest = z.infer<typeof DailyDigestSchema>;

// JSON Schema definition for OpenAI Responses API strict mode
// Insights are optional; other top-level fields are required
export const DailyDigestJsonSchemaForLLM: any = {
  type: 'object',
  additionalProperties: false,
  // For Responses strict mode, all properties must be listed in required, even optional ones
  required: ['discussions', 'resources', 'unanswered_questions', 'stats', 'insights'],
  properties: {
    discussions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'question', 'participants', 'outcome'],
        properties: {
          topic: { type: 'string' },
          question: { type: 'string' },
          participants: { type: 'array', items: { type: 'string' } },
          outcome: { type: 'string' },
        },
      },
    },
    resources: { type: 'array', items: { type: 'string' } },
    unanswered_questions: { type: 'array', items: { type: 'string' } },
    stats: {
      type: 'object',
      // Require core counters; allow additional numeric fields from data
      additionalProperties: { type: ['integer', 'number'] },
      required: ['messages_count', 'participants_count'],
      properties: {
        messages_count: { type: 'integer' },
        participants_count: { type: 'integer' },
      },
    },
    insights: { type: 'array', items: { type: 'string' } },
  },
};


