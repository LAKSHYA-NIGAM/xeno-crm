"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Sparkles, Users, RefreshCw, AlertCircle, Plus, ChevronRight, User } from "lucide-react";
import { api, Segment, SegmentPreviewResult } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Skeleton } from "@/components/ui/skeleton";

interface SegmentRules {
  last_order_days_gt: number | null;
  total_spend_gt: number | null;
  order_count_gte: number | null;
  cities: string[];
  preferred_channels: string[] | null;
}

interface RuleRowProps {
  label: string;
  children: React.ReactNode;
}

function RuleRow({ label, children }: RuleRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-border-subtle last:border-0">
      <span className="text-[13px] font-medium text-text-secondary">{label}</span>
      <div className="flex items-center gap-2 text-text-primary text-[13px]">
        {children}
      </div>
    </div>
  );
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);

  // AI Suggest Panel States
  const [goal, setGoal] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [suggestedRules, setSuggestedRules] = useState<any>(null);
  const [suggestedName, setSuggestedName] = useState("");
  const [rationale, setRationale] = useState("");
  const [estimatedCount, setEstimatedCount] = useState(0);

  // Rule Builder Form States
  const [rules, setRules] = useState<SegmentRules>({
    last_order_days_gt: null,
    total_spend_gt: null,
    order_count_gte: null,
    cities: [],
    preferred_channels: null,
  });
  const [segmentName, setSegmentName] = useState("");
  const [segmentDescription, setSegmentDescription] = useState("");

  // Live Preview States
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<SegmentPreviewResult | null>(null);

  // Load Saved Segments
  const loadSegments = async () => {
    setLoading(true);
    try {
      const data = await api.getSegments();
      setSegments(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load segments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSegments();
  }, []);

  // Debounce preview Segment on rules modification (400ms)
  useEffect(() => {
    if (!showBuilder) return;

    // Check if at least one rule filter has been set to run preview
    const hasActiveFilters = 
      rules.last_order_days_gt !== null ||
      rules.total_spend_gt !== null ||
      rules.order_count_gte !== null ||
      rules.cities.length > 0 ||
      rules.preferred_channels !== null;

    if (!hasActiveFilters) {
      setPreviewResult(null);
      return;
    }

    setPreviewLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const preview = await api.previewSegment(rules);
        setPreviewResult(preview);
      } catch (err) {
        console.error(err);
        setPreviewResult(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [rules, showBuilder]);

  // AI suggestion streaming handler
  const handleSuggest = async () => {
    if (!goal.trim()) {
      toast.error("Describe your audience goal first");
      return;
    }

    setStreaming(true);
    setStreamedText("");
    setSuggestedRules(null);
    setSuggestedName("");
    setRationale("");
    setEstimatedCount(0);

    try {
      const response = await api.streamSegmentSuggest(goal);
      if (!response.body) {
        throw new Error("No response body available for streaming suggestions");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            const data = JSON.parse(jsonStr);

            if (data.text) {
              setStreamedText(prev => prev + data.text);
            }

            if (data.done && data.result) {
              const res = data.result;
              setSuggestedRules(res.rules);
              setSuggestedName(res.audience_name);
              setRationale(res.rationale);
              setEstimatedCount(res.estimated_count);

              // Auto-populate the rule builder
              setRules({
                last_order_days_gt: res.rules?.last_order_days_gt ?? null,
                total_spend_gt: res.rules?.total_spend_gt ?? null,
                order_count_gte: res.rules?.order_count_gte ?? null,
                cities: res.rules?.cities ?? [],
                preferred_channels: res.rules?.preferred_channels ?? null,
              });
              setSegmentName(res.audience_name || "");
              setSegmentDescription(res.rationale || "");
            }
          } catch (e) {
            console.error("JSON parse error inside stream", e);
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("AI suggesting encountered an error");
    } finally {
      setStreaming(false);
    }
  };

  // Delete a segment
  const handleDeleteSegment = async (segmentId: string) => {
    const confirmed = window.confirm("Delete this segment?");
    if (!confirmed) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/segments/${segmentId}`, {
        method: "DELETE",
      });
      setSegments((prev) => prev.filter((s) => s.id !== segmentId));
      toast.success("Segment deleted");
    } catch (e) {
      toast.error("Failed to delete segment");
    }
  };

  // Create & save segment
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segmentName.trim()) {
      toast.error("Please provide a segment name");
      return;
    }

    try {
      await api.createSegment({
        name: segmentName,
        description: segmentDescription || "Targeted consumer demographic segment",
        rule_json: rules,
      });

      toast.success("Segment saved ✓");
      loadSegments();

      // Reset
      setRules({
        last_order_days_gt: null,
        total_spend_gt: null,
        order_count_gte: null,
        cities: [],
        preferred_channels: null,
      });
      setSegmentName("");
      setSegmentDescription("");
      setSuggestedRules(null);
      setSuggestedName("");
      setRationale("");
      setEstimatedCount(0);
      setStreamedText("");
      setGoal("");
      setShowBuilder(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save segment");
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
  };

  const getRuleSummaryTags = (ruleJson: Record<string, any>) => {
    const tags: string[] = [];
    if (ruleJson.last_order_days_gt !== undefined && ruleJson.last_order_days_gt !== null) {
      tags.push(`${ruleJson.last_order_days_gt}+ days inactive`);
    }
    if (ruleJson.total_spend_gt !== undefined && ruleJson.total_spend_gt !== null) {
      tags.push(`₹${ruleJson.total_spend_gt}+ spend`);
    }
    if (ruleJson.order_count_gte !== undefined && ruleJson.order_count_gte !== null) {
      tags.push(`${ruleJson.order_count_gte}+ orders`);
    }
    if (ruleJson.cities && ruleJson.cities.length > 0) {
      tags.push(ruleJson.cities.join(", "));
    }
    if (ruleJson.preferred_channels && ruleJson.preferred_channels.length > 0) {
      tags.push(ruleJson.preferred_channels.join(", "));
    }
    return tags.slice(0, 3);
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-y-auto">
      <PageHeader
        title="Audience Builder"
        description="Find the right shoppers for every campaign"
        action={
          <button
            onClick={() => {
              setShowBuilder(!showBuilder);
              if (showBuilder) {
                // Clear state when closing builder
                setGoal("");
                setSuggestedRules(null);
                setSuggestedName("");
                setRationale("");
                setEstimatedCount(0);
              }
            }}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-accent-purple hover:bg-accent-purple/95 text-text-primary text-xs font-semibold shadow-lg shadow-accent-purple/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{showBuilder ? "View Saved" : "New Segment"}</span>
          </button>
        }
      />

      <div className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8">
        {showBuilder && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-3 duration-250">
            {/* AI Suggest Panel */}
            <div className="rounded-xl border border-border-default bg-bg-secondary p-6 shadow-xl relative overflow-hidden border-l-4 border-l-accent-purple bg-bg-highlight/5">
              <div className="flex items-center space-x-2 pb-1.5">
                <span className="text-accent-purple text-sm">✦</span>
                <h3 className="text-[13px] font-semibold text-text-primary tracking-wide">
                  AI Audience Builder
                </h3>
              </div>
              <p className="text-[12px] text-text-secondary mb-4">
                Describe your campaign goal and AI will suggest the right segment
              </p>

              <div className="flex gap-3 max-w-3xl">
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  disabled={streaming}
                  placeholder="e.g. Win back high-value customers who haven't bought in 45 days"
                  className="flex-1 rounded-lg border border-border-default bg-neutral-900/60 px-4 py-2.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-all"
                />
                <button
                  type="button"
                  onClick={handleSuggest}
                  disabled={streaming || !goal.trim()}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-accent-purple disabled:opacity-50 text-text-primary text-xs font-bold transition-all shadow-md shadow-accent-purple/10 cursor-pointer"
                >
                  {streaming ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Streaming...</span>
                    </>
                  ) : (
                    <span>Suggest →</span>
                  )}
                </button>
              </div>

              {/* Streaming Indicator */}
              {streaming && (
                <div className="mt-4 flex items-center space-x-2 text-xs text-accent-purple/80 font-medium">
                  <div className="flex space-x-1 items-center">
                    <span className="h-1.5 w-1.5 bg-accent-purple rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 bg-accent-purple rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 bg-accent-purple rounded-full animate-bounce" />
                  </div>
                  <span>AI is mapping segment rules...</span>
                </div>
              )}

              {/* AI Result Card */}
              {suggestedRules && !streaming && (
                <div className="mt-5 p-5 rounded-lg bg-bg-highlight/20 border border-accent-purple/15 max-w-3xl space-y-2.5 animate-in fade-in slide-in-from-top-1.5 duration-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[15px] font-semibold text-text-primary">
                      {suggestedName}
                    </h4>
                    <span className="text-[12px] font-semibold text-accent-green">
                      {estimatedCount} customers match
                    </span>
                  </div>
                  <p className="text-[12px] text-text-secondary leading-relaxed">
                    {rationale}
                  </p>
                  <p className="text-[10px] text-text-tertiary font-medium">
                    Rules applied to builder ↓
                  </p>
                </div>
              )}
            </div>

            {/* Side-by-side Builder & Preview */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Panel - Rule Builder */}
              <div className="lg:col-span-2 rounded-xl border border-border-default bg-bg-secondary p-6 shadow-xl space-y-6">
                <div className="pb-1.5 border-b border-border-subtle">
                  <h3 className="text-[14px] font-semibold text-text-primary">Configure Segment Rules</h3>
                </div>

                <div className="space-y-1">
                  {/* Last order days */}
                  <RuleRow label="Last order more than">
                    <input
                      type="number"
                      value={rules.last_order_days_gt ?? ""}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          last_order_days_gt: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder="N"
                      className="w-16 bg-neutral-900 border border-border-default rounded-md px-2 py-1 text-center text-text-primary text-xs focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-text-secondary text-xs">days ago</span>
                  </RuleRow>

                  {/* Total spend */}
                  <RuleRow label="Total spend greater than">
                    <span className="text-text-secondary text-xs">₹</span>
                    <input
                      type="number"
                      value={rules.total_spend_gt ?? ""}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          total_spend_gt: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="amount"
                      className="w-24 bg-neutral-900 border border-border-default rounded-md px-2 py-1 text-center text-text-primary text-xs focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </RuleRow>

                  {/* Order count */}
                  <RuleRow label="Order count at least">
                    <input
                      type="number"
                      value={rules.order_count_gte ?? ""}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          order_count_gte: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder="N"
                      className="w-16 bg-neutral-900 border border-border-default rounded-md px-2 py-1 text-center text-text-primary text-xs focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-text-secondary text-xs">orders</span>
                  </RuleRow>

                  {/* Cities multiselect */}
                  <RuleRow label="In cities">
                    <div className="w-56">
                      <MultiSelect
                        options={["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata"]}
                        value={rules.cities || []}
                        onChange={(v) => setRules({ ...rules, cities: v })}
                        placeholder="Select cities..."
                      />
                    </div>
                  </RuleRow>

                  {/* Channel preference */}
                  <RuleRow label="Preferred channel">
                    <select
                      value={rules.preferred_channels?.[0] || "any"}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRules({
                          ...rules,
                          preferred_channels: val === "any" ? null : [val],
                        });
                      }}
                      className="rounded-lg border border-border-default bg-neutral-900/40 px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-purple cursor-pointer focus:ring-1 focus:ring-accent-purple"
                    >
                      <option value="any">any</option>
                      <option value="email">email</option>
                      <option value="whatsapp">whatsapp</option>
                      <option value="sms">sms</option>
                    </select>
                  </RuleRow>
                </div>

                <form onSubmit={handleSave} className="space-y-4 pt-4 border-t border-border-subtle">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                        Segment Name
                      </label>
                      <input
                        type="text"
                        required
                        value={segmentName}
                        onChange={(e) => setSegmentName(e.target.value)}
                        placeholder="e.g. Inactive Skincare VIPs"
                        className="rounded-lg border border-border-default bg-neutral-900/40 px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple"
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                        Rationale / Description
                      </label>
                      <input
                        type="text"
                        value={segmentDescription}
                        onChange={(e) => setSegmentDescription(e.target.value)}
                        placeholder="e.g. VIP customers missing for 45 days"
                        className="rounded-lg border border-border-default bg-neutral-900/40 px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBuilder(false);
                        setRules({
                          last_order_days_gt: null,
                          total_spend_gt: null,
                          order_count_gte: null,
                          cities: [],
                          preferred_channels: null,
                        });
                        setSegmentName("");
                        setSegmentDescription("");
                      }}
                      className="px-4 py-2 border border-border-default hover:bg-bg-tertiary rounded-lg text-text-secondary hover:text-text-primary text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-accent-purple hover:bg-accent-purple/95 rounded-lg text-text-primary text-xs font-bold shadow-md cursor-pointer"
                    >
                      Save Segment
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Panel - Live Preview */}
              <div className="rounded-xl border border-border-default bg-bg-secondary p-6 shadow-xl flex flex-col min-h-[300px]">
                <div className="pb-1.5 border-b border-border-subtle mb-4">
                  <h3 className="text-[14px] font-semibold text-text-primary">Live Query Preview</h3>
                </div>

                {previewLoading ? (
                  <div className="flex-1 flex flex-col justify-center space-y-4">
                    <div className="space-y-2 text-center">
                      <Skeleton className="h-10 w-24 mx-auto" />
                      <Skeleton className="h-4 w-32 mx-auto" />
                    </div>
                    <div className="border-t border-border-subtle pt-4 space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <div className="space-y-1">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                  </div>
                ) : previewResult ? (
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* Metric Display */}
                      <div className="text-center py-4 bg-bg-highlight/10 rounded-lg border border-accent-purple/10">
                        <span className="text-4xl font-extrabold text-accent-purple leading-none tracking-tight">
                          {previewResult.count}
                        </span>
                        <p className="text-[12px] text-text-secondary mt-1.5 font-medium">
                          customers match
                        </p>
                      </div>

                      {/* Sample Customers */}
                      <div className="mt-5 space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary block">
                          Sample Customers
                        </span>

                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {previewResult.sample_customers.map((cust) => (
                            <div
                              key={cust.id}
                              className="flex items-center gap-3 p-2 bg-bg-tertiary/40 border border-border-subtle rounded-lg hover:border-border-default transition-all"
                            >
                              {/* Avatar */}
                              <div className="h-8 w-8 rounded-full bg-accent-purple-dim text-accent-purple flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                {getInitials(cust.first_name, cust.last_name)}
                              </div>
                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-text-primary truncate">
                                    {cust.first_name} {cust.last_name}
                                  </p>
                                  <span className="text-[10px] text-text-tertiary font-medium">
                                    {cust.city}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center mt-0.5">
                                  <span className="text-[10px] text-text-secondary font-medium">
                                    {cust.preferred_channel}
                                  </span>
                                  <span className="text-[10px] text-text-tertiary">
                                    ₹{cust.total_spend.toLocaleString("en-IN")} spend
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border-default rounded-xl bg-neutral-950/20">
                    <span className="text-xl text-text-tertiary mb-2">⚠️</span>
                    <p className="text-xs font-semibold text-text-secondary">
                      No customer rules active
                    </p>
                    <p className="text-[11px] text-text-tertiary mt-1 max-w-xs leading-relaxed">
                      Modify fields or run suggestions above to preview matched database counts.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Saved Segments Grid */}
        <div className="space-y-4">
          <div className="pb-1 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-text-primary tracking-wide">
              Saved Segments
            </h2>
            <span className="text-xs text-text-secondary font-semibold bg-bg-secondary px-2.5 py-1 rounded-md border border-border-default">
              Total: {segments.length}
            </span>
          </div>

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : segments.length === 0 ? (
            <div className="py-12 text-center bg-bg-secondary border border-border-default rounded-xl">
              <Users className="h-8 w-8 text-text-tertiary mx-auto mb-2.5" />
              <p className="text-xs font-semibold text-text-secondary">No saved segments yet</p>
              <p className="text-[11px] text-text-tertiary mt-1">
                Construct your first customer partition using rule fields.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {segments.map((seg) => {
                const tags = getRuleSummaryTags(seg.rule_json);
                return (
                  <div
                    key={seg.id}
                    className="relative overflow-hidden rounded-xl border border-border-default bg-bg-secondary p-6 shadow-md flex flex-col justify-between group hover:border-accent-purple/45 transition-all duration-300 min-h-[180px]"
                  >
                    {/* Top Accent Gradient */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent-purple/35 to-accent-blue/35" />

                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[14px] font-semibold text-text-primary group-hover:text-accent-purple transition-colors truncate">
                          {seg.name}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple text-[10px] font-bold border border-accent-purple/15 flex-shrink-0">
                          {seg.estimated_count} match
                        </span>
                      </div>

                      <p className="text-[12px] text-text-secondary line-clamp-2 leading-relaxed h-8">
                        {seg.description}
                      </p>

                      {/* Rule tags */}
                      <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border-subtle">
                        {tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-bg-tertiary border border-border-default text-[9px] font-semibold text-text-secondary truncate max-w-[120px]"
                          >
                            {tag}
                          </span>
                        ))}
                        {tags.length === 0 && (
                          <span className="text-[9px] text-text-tertiary italic">No filter constraints</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 flex items-center justify-between border-t border-border-subtle text-[10px] text-text-tertiary">
                      <span>
                        Created {seg.created_at ? new Date(seg.created_at).toLocaleDateString() : "Draft"}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSegment(seg.id);
                          }}
                          style={{
                            fontSize: 11,
                            color: "#EF4444",
                            background: "none",
                            border: "1px solid #2A2A2A",
                            borderRadius: "4px",
                            padding: "3px 8px",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                        <Link
                          href={`/campaigns?new=true&segment_id=${seg.id}`}
                          className="flex items-center gap-0.5 text-accent-purple hover:text-accent-purple/85 font-semibold transition-all"
                        >
                          <span>Use in Campaign</span>
                          <ChevronRight className="h-3 w-3 stroke-[2.5]" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
