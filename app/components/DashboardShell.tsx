"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HourlyChart } from "./charts/HourlyChart";
import { DailyChart } from "./charts/DailyChart";
import { SummaryList } from "./atoms/SummaryList";
import { KpiRow } from "./atoms/KpiRow";
import { TopLinksTable } from "./tables/TopLinksTable";
import { TopWordsTable } from "./tables/TopWordsTable";
import { TopThreadsTable } from "./tables/TopThreadsTable";
import { UnansweredTable } from "./tables/UnansweredTable";
import { TopHelpersTable } from "./tables/TopHelpersTable";
import { TopErrorsTable } from "./tables/TopErrorsTable";
import { ForwardedFromTable } from "./tables/ForwardedFromTable";
import { ArtifactsTable } from "./tables/ArtifactsTable";
import { HashtagsTable } from "./tables/HashtagsTable";
import { MentionsTable } from "./tables/MentionsTable";
import { ChatSelect } from "./filters/ChatSelect";
import { WindowSelect } from "./filters/WindowSelect";

type ApiData = any;

export default function DashboardShell({ days: initialDays = 1 }: { days?: number }) {
  const [days, setDays] = useState<number>(initialDays);
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const defaultApplied = useRef<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (days && days !== 1) params.set('days', String(days));
    if (chatId) params.set('chat_id', chatId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    fetch(`/api/overview${qs}`, { signal: controller.signal })
      .then((r) => r.json())
      .then(setData)
      .catch((e) => { if (e.name !== "AbortError") setError("load_error"); });
    return () => controller.abort();
  }, [days, chatId]);

  useEffect(() => {
    if (defaultApplied.current) return;
    if (!data || chatId !== null) return;
    const chats: any[] = Array.isArray(data.chats) ? data.chats : [];
    if (chats.length > 0) {
      setChatId(String(chats[0].chat_id));
      defaultApplied.current = true;
    }
  }, [data, chatId]);

  if (error) return <div className="panel text-sm text-red-800 bg-red-50 border-red-200">Ошибка загрузки</div>;
  if (!data) return (
    <div className="panel">
      <div className="space-y-2 animate-pulse">
        <div className="h-4 bg-gray-100 rounded" />
        <div className="h-4 bg-gray-100 rounded w-11/12" />
        <div className="h-4 bg-gray-100 rounded w-10/12" />
      </div>
    </div>
  );

  const kpi = data?.kpi ?? { total_msgs: 0, unique_users: 0, avg_per_user: 0, replies: 0, with_links: 0 };
  const summaryBullets: string[] = Array.isArray(data?.summaryBullets) ? data.summaryBullets : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-3 flex items-center gap-3 justify-between">
        <ChatSelect chats={data.chats || []} value={chatId} onChange={setChatId} />
        <WindowSelect value={days} onChange={setDays} />
      </div>

      <KpiRow kpi={kpi} />

      <SummaryList items={summaryBullets} />

      {days > 1 ? (
        <DailyChart dailyRows={Array.isArray(data.daily) ? data.daily : []} />
      ) : (
        <HourlyChart since={data.since} hourlyRows={Array.isArray(data.hourly) ? data.hourly : []} />
      )}

      <UnansweredTable rows={Array.isArray(data.unanswered) ? data.unanswered : []} />
      <TopErrorsTable rows={Array.isArray(data.topErrors) ? data.topErrors : []} />
      <TopHelpersTable rows={Array.isArray(data.topHelpers) ? data.topHelpers : []} />
      <TopThreadsTable rows={Array.isArray(data.topThreads) ? data.topThreads : []} />

      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <TopLinksTable rows={Array.isArray(data.topLinks) ? data.topLinks : []} />
        <TopWordsTable rows={Array.isArray(data.topWords) ? data.topWords : []} />
        <ArtifactsTable rows={Array.isArray(data.artifacts) ? data.artifacts : []} />
        <HashtagsTable rows={Array.isArray(data.topHashtags) ? data.topHashtags : []} />
        <MentionsTable rows={Array.isArray(data.topMentions) ? data.topMentions : []} />
      </div>

      <ForwardedFromTable rows={Array.isArray(data.forwardedFrom) ? data.forwardedFrom : []} />
    </div>
  );
}


