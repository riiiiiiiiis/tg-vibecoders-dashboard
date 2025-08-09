import { z } from 'zod';

// Zod schema for the "live" daily digest
// Mirrors the user's DAILY_DIGEST_SCHEMA JSON Schema
export const DailyDigestSchema = z.object({
  title: z.string(),
  hot_topics: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      examples: z.array(z.string()).optional().default([]),
    })
  ).min(3).max(3),
  tools_resources: z.array(z.string()).optional().default([]),
  insights: z.array(z.string()).optional().default([]),
  awards: z.array(z.string()).optional().default([]),
  stats: z.object({
    total_messages: z.number().int(),
    new_members: z.number().int().optional().nullable(),
    peak_activity: z.string().optional().nullable(),
  }),
  bonus: z.string().optional().nullable(),
});

export type DailyDigest = z.infer<typeof DailyDigestSchema>;

// JSON Schema definition for OpenAI Responses API strict mode
export const DailyDigestJsonSchemaForLLM: any = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'hot_topics', 'tools_resources', 'insights', 'awards', 'stats', 'bonus'],
  properties: {
    title: { type: 'string' },
    hot_topics: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'examples'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          examples: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    tools_resources: { type: 'array', items: { type: 'string' } },
    insights: { type: 'array', items: { type: 'string' } },
    awards: { type: 'array', items: { type: 'string' } },
    stats: {
      type: 'object',
      additionalProperties: false,
      required: ['total_messages', 'new_members', 'peak_activity'],
      properties: {
        total_messages: { type: 'integer' },
        new_members: { type: ['integer', 'null'] },
        peak_activity: { type: ['string', 'null'] },
      },
    },
    bonus: { type: ['string', 'null'] },
  },
};


