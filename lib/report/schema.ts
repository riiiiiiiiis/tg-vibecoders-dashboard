import { z } from 'zod';

export const PreviewSchema = z.object({
  kpi: z.object({
    total_msgs: z.number(),
    unique_users: z.number(),
    avg_per_user: z.number(),
    replies: z.number(),
    with_links: z.number(),
    peak_hour_utc: z.string(),
    window_utc: z.tuple([z.string(), z.string()]),
  }),
  hourly: z.array(z.object({ hour: z.string(), cnt: z.number() })),
  topThreads: z.array(z.object({ root_id: z.string(), replies: z.number(), root_preview: z.string() })),
  unanswered: z.array(z.object({ id: z.string(), hours: z.number(), preview: z.string() })),
  topLinks: z.array(z.object({ url: z.string(), cnt: z.number() })),
  topErrors: z.array(z.object({ token: z.string(), cnt: z.number() })),
  messages: z.array(z.object({ id: z.string(), user_id: z.string(), sent_at: z.string(), text: z.string().nullable(), reply_to: z.string().nullable() })).optional(),
  meta: z.object({ date: z.string(), chat_id: z.string().nullable(), generated_at: z.string() }),
});

export type PreviewType = z.infer<typeof PreviewSchema>;

export const LlmJsonSchema = z.object({
  summary: z.object({
    highlights: z.array(z.string()),
    kpi: z.object({
      total_msgs: z.number(),
      unique_users: z.number(),
      avg_per_user: z.number(),
      replies: z.number(),
      with_links: z.number(),
      peak_hour_utc: z.string(),
      window_utc: z.tuple([z.string(), z.string()]),
    }),
    trends_vs_prev_day: z.object({
      total_msgs_pct: z.number().nullable(),
      replies_pct: z.number().nullable(),
      unique_users_pct: z.number().nullable(),
    }),
  }),
  themes: z.array(z.object({
    title: z.string(),
    insight: z.string(),
    samples: z.array(z.object({ message_id: z.string(), preview: z.string() })),
  })),
  top_threads: z.array(z.object({ root_id: z.string(), replies: z.number(), root_preview: z.string() })),
  unanswered: z.array(z.object({ id: z.string(), hours: z.number(), preview: z.string() })),
  errors: z.array(z.object({ token: z.string(), cnt: z.number() })),
  top_links: z.array(z.object({ url: z.string(), cnt: z.number() })),
  actions_for_tomorrow: z.array(z.string()),
  data_limits: z.array(z.string()),
});

export type LlmJsonType = z.infer<typeof LlmJsonSchema>;


