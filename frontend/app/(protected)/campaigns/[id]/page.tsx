"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { 
  ArrowLeft, Search, Filter, RefreshCw, MessageSquare, Mail, Phone, Clock, FileText, Users, Calendar
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, Legend
} from "recharts";
import { api, TimelineEvent } from "@/lib/api";
import { useCampaignPolling } from "@/hooks/useCampaignPolling";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

const FUNNEL_COLORS: Record<string, string> = {
  Audience:  "#3B82F6",
  Sent:      "#8B5CF6",
  Delivered: "#10B981",
  Opened:    "#10B981",
  Read:      "#8B5CF6",
  Clicked:   "#F59E0B",
};

const EVENT_COLORS: Record<string, string> = {
  sent:      "#3B82F6",
  delivered: "#10B981",
  opened:    "#8B5CF6",
  read:      "#A78BFA",
  clicked:   "#F59E0B",
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { campaign, loading, refetch } = useCampaignPolling(id);

  // States
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMounted, setIsMounted] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch charts data in tandem with polling
  useEffect(() => {
    if (!campaign) return;
    let active = true;

    const fetchChartsData = async () => {
      try {
        const [funnelRes, timelineRes] = await Promise.all([
          api.getCampaignFunnel(id),
          api.getCampaignTimeline(id),
        ]);
        if (!active) return;
        setFunnelData(funnelRes.funnel);
        setTimelineData(transformTimeline(timelineRes.timeline));
      } catch (err) {
        console.error("Failed to load campaign analytics details", err);
      }
    };

    fetchChartsData();
    return () => {
      active = false;
    };
  }, [campaign, id]);

  const transformTimeline = (raw: TimelineEvent[]) => {
    const hours = [...new Set(raw.map(r => r.hour))].sort();
    return hours.map(hour => {
      const entry: any = { hour: format(new Date(hour), "HH:mm") };
      raw.filter(r => r.hour === hour).forEach(r => {
        entry[r.event_type] = r.count;
      });
      return entry;
    });
  };

  if (loading || !campaign) {
    return (
      <div className="flex-1 p-8 space-y-6 bg-bg-primary overflow-y-auto pl-[220px]">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  // Recipients filter
  const recipients = campaign.recipients || [];
  const filteredRecipients = recipients.filter(r => {
    const matchesSearch = 
      r.customer_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (r.email && r.email.toLowerCase().includes(debouncedSearch.toLowerCase()));
    const matchesStatus = statusFilter === "all" || r.current_status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const pageSize = 20;
  const totalPages = Math.ceil(filteredRecipients.length / pageSize);
  const paginatedRecipients = filteredRecipients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getRelativeTime = (timeStr: string | null) => {
    if (!timeStr || !isMounted) return "—";
    try {
      return formatDistanceToNow(new Date(timeStr), { addSuffix: true });
    } catch (e) {
      return "—";
    }
  };

  const getFormattedDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "yyyy-MM-dd HH:mm");
    } catch (e) {
      return "—";
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
  };

  const isLive = campaign.status === "launched";

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-y-auto">
      {/* Dynamic Header */}
      <PageHeader
        title={campaign.name}
        description={campaign.objective}
        action={
          <div className="bg-bg-secondary border border-border-default rounded-xl p-4 text-[11px] text-text-secondary space-y-1.5 w-64 shadow-md">
            <div>
              <span className="text-text-tertiary font-bold uppercase tracking-wider block">Launched</span>
              <span className="text-text-primary font-medium">
                {campaign.launched_at ? format(new Date(campaign.launched_at), "MMM d, yyyy 'at' h:mm a") : "Draft"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Segment:</span>
              <Link href="/segments" className="text-accent-purple hover:underline font-semibold">
                Target Segment
              </Link>
            </div>
            <div className="flex justify-between">
              <span>Audience Size:</span>
              <span className="text-text-primary font-medium">{campaign.audience_size} customers</span>
            </div>
            <div className="flex justify-between">
              <span>Channel:</span>
              <span className="text-text-primary font-medium capitalize">{campaign.channel}</span>
            </div>
            <div className="pt-1.5 border-t border-border-subtle">
              <span className="text-text-tertiary block font-semibold">Message Preview</span>
              <span className="text-text-secondary italic block line-clamp-1">
                {campaign.message_template ? campaign.message_template.slice(0, 80) + "..." : "—"}
              </span>
            </div>
          </div>
        }
      />

      <div className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8">
        {/* Back Link & Live Pulse */}
        <div className="flex items-center justify-between">
          <Link href="/campaigns" className="flex items-center space-x-1 text-xs text-text-secondary hover:text-text-primary font-semibold transition-all">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Campaigns</span>
          </Link>

          {isLive && (
            <span className="flex items-center gap-1.5 text-xs text-accent-green font-semibold bg-accent-green/10 border border-accent-green/20 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
              Live Polling Active
            </span>
          )}
        </div>

        {/* Section 1: Compact Stat Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard compact label="Sent" value={campaign.analytics?.sent ?? 0} accent="blue" />
          <StatCard compact label="Delivered" value={campaign.analytics?.delivered ?? 0} accent="green" />
          <StatCard compact label="Failed" value={campaign.analytics?.failed ?? 0} accent="red" />
          <StatCard compact label="Opened" value={campaign.analytics?.opened ?? 0} accent="purple" />
          <StatCard compact label="Read" value={campaign.analytics?.read ?? 0} accent="purple" />
          <StatCard compact label="Clicked" value={campaign.analytics?.clicked ?? 0} accent="amber" />
        </div>

        {/* Rate Pills */}
        <div className="flex flex-wrap gap-2.5 pt-1.5">
          <div className="bg-bg-secondary border border-border-default rounded-full px-3 py-1.5 text-xs flex items-center gap-1.5 font-medium shadow-sm">
            <span className="text-text-secondary">Delivery rate:</span>
            <span className="text-text-primary font-bold">{campaign.analytics?.delivery_rate ?? 0}%</span>
          </div>
          <div className="bg-bg-secondary border border-border-default rounded-full px-3 py-1.5 text-xs flex items-center gap-1.5 font-medium shadow-sm">
            <span className="text-text-secondary">Open rate:</span>
            <span className="text-text-primary font-bold">{campaign.analytics?.open_rate ?? 0}%</span>
          </div>
          <div className="bg-bg-secondary border border-border-default rounded-full px-3 py-1.5 text-xs flex items-center gap-1.5 font-medium shadow-sm">
            <span className="text-text-secondary">Click rate:</span>
            <span className="text-text-primary font-bold">{campaign.analytics?.click_rate ?? 0}%</span>
          </div>
        </div>

        {/* Section 2: Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Funnel chart card */}
          <div className="rounded-xl border border-border-default bg-bg-secondary p-5 shadow-lg space-y-4">
            <div>
              <h3 className="text-[13px] font-semibold text-text-primary tracking-wide">Delivery Funnel</h3>
              <p className="text-[11px] text-text-secondary mt-0.5">Recipients by stage</p>
            </div>
            {funnelData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-text-tertiary text-xs">
                No funnel statistics available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={funnelData}
                  layout="vertical"
                  margin={{ left: 16, right: 32, top: 8, bottom: 8 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    width={80}
                    tick={{ fill: "#888888", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111111",
                      border: "1px solid #2A2A2A",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#F2F2F2"
                    }}
                    cursor={{ fill: "#1A1A1A" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {funnelData.map((entry) => (
                      <Cell key={entry.stage} fill={FUNNEL_COLORS[entry.stage] || "#8B5CF6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Area chart card */}
          <div className="rounded-xl border border-border-default bg-bg-secondary p-5 shadow-lg space-y-4">
            <div>
              <h3 className="text-[13px] font-semibold text-text-primary tracking-wide">Events Over Time</h3>
              <p className="text-[11px] text-text-secondary mt-0.5">Communication event velocity</p>
            </div>
            {timelineData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-text-tertiary text-xs">
                No timeline records logged yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={timelineData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                  <defs>
                    {Object.entries(EVENT_COLORS).map(([key, color]) => (
                      <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="hour" tick={{ fill: "#888888", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#888888", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#111111", border: "1px solid #2A2A2A", borderRadius: "8px", fontSize: "12px", color: "#F2F2F2" }} />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "#888888" }} />
                  {Object.entries(EVENT_COLORS).map(([key, color]) => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={color}
                      strokeWidth={1.5}
                      fill={`url(#grad-${key})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Section 3: Recipients Table */}
        <div className="space-y-4 pt-4 border-t border-border-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary tracking-wide">Recipients Log</h2>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Showing {filteredRecipients.length} of {recipients.length} recipients
              </p>
            </div>

            {/* Filter inputs */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search recipients..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 pr-3 py-1.5 w-56 rounded-lg border border-border-default bg-neutral-900/40 text-xs text-text-primary focus:outline-none focus:border-accent-purple"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-border-default bg-neutral-900/40 px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-purple cursor-pointer"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
                <option value="opened">Opened</option>
                <option value="read">Read</option>
                <option value="clicked">Clicked</option>
              </select>
            </div>
          </div>

          {paginatedRecipients.length === 0 ? (
            <EmptyState
              icon={<Search className="h-8 w-8 text-text-tertiary" />}
              title="No recipients found"
              description="Try adjusting your search criteria or status filter dropdown options."
            />
          ) : (
            <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden shadow-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-bold text-text-tertiary uppercase tracking-wider bg-bg-tertiary/20">
                    <th className="py-3 px-6">Recipient</th>
                    <th className="py-3 px-6">Channel</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6">Sent At</th>
                    <th className="py-3 px-6">Last Event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-xs">
                  {paginatedRecipients.map((rec) => (
                    <tr key={rec.id} className="hover:bg-bg-tertiary/20 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-accent-purple-dim text-accent-purple flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {getInitials(rec.customer_name)}
                          </div>
                          <div>
                            <span className="font-bold text-text-primary block">{rec.customer_name}</span>
                            <span className="text-[10px] text-text-tertiary block mt-0.5">{rec.email || "Phone SMS/WA"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          campaign.channel === "whatsapp" 
                            ? "bg-accent-green/10 text-accent-green" 
                            : campaign.channel === "email" 
                            ? "bg-accent-blue/10 text-accent-blue" 
                            : "bg-neutral-800 text-text-secondary"
                        }`}>
                          {campaign.channel}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <StatusBadge status={rec.current_status} />
                      </td>
                      <td className="py-3.5 px-6 text-text-secondary">
                        {getFormattedDate(campaign.launched_at)}
                      </td>
                      <td className="py-3.5 px-6 text-text-secondary font-medium">
                        {getRelativeTime(rec.last_event_time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border-subtle text-xs">
              <span className="text-text-secondary">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-4 py-2 border border-border-default hover:bg-bg-tertiary rounded-lg text-text-secondary hover:text-text-primary font-semibold disabled:opacity-40 transition-all cursor-pointer"
                >
                  ← Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-4 py-2 border border-border-default hover:bg-bg-tertiary rounded-lg text-text-secondary hover:text-text-primary font-semibold disabled:opacity-40 transition-all cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
