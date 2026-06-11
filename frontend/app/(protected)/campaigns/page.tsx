"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { 
  Sparkles, Megaphone, Send, Mail, MessageSquare, Phone, Rocket, ArrowLeft, 
  RefreshCw, AlertCircle, Plus, Eye, X, Check, ArrowRight
} from "lucide-react";
import { 
  api, Campaign, CampaignDetail, Segment, FunnelStage 
} from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { StreamingText } from "@/components/ui/StreamingText";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

const COMPOSER_STEPS = ["Choose Audience", "Write Message", "Choose Channel", "Review & Launch"];

const TONES = ["Warm", "Premium", "Urgent", "Playful"];
const TONE_MAP: Record<string, string> = {
  Warm: "warm and premium",
  Premium: "sophisticated and luxury",
  Urgent: "urgent and time-sensitive",
  Playful: "witty and conversational"
};

const CHANNEL_CARDS = [
  { id: "whatsapp", name: "WhatsApp", icon: "📱", rate: "93%" },
  { id: "email", name: "Email", icon: "✉️", rate: "88%" },
  { id: "sms", name: "SMS", icon: "💬", rate: "91%" }
];

function CampaignsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewCampaign = searchParams.get("new") === "true" || !!searchParams.get("segment_id");
  const preSelectedSegmentId = searchParams.get("segment_id");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [segmentsLoading, setSegmentsLoading] = useState(true);

  // Composer Wizard States
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);

  // Step 1: AI Segment suggestion states
  const [aiGoal, setAiGoal] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState("");
  const [streamedText, setStreamedText] = useState("");

  // Step 2: Message drafting states
  const [objective, setObjective] = useState("Reactivate lapsed VIP customers");
  const [selectedTone, setSelectedTone] = useState("Warm");
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [editableMessage, setEditableMessage] = useState("");

  // Step 3: Channel states
  const [selectedChannel, setSelectedChannel] = useState<string>("whatsapp");
  const [campaignName, setCampaignName] = useState("");

  // Step 4: Launch states
  const [launching, setLaunching] = useState(false);

  // Campaign Detail Modal states
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [campaignDetail, setCampaignDetail] = useState<CampaignDetail | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);

  // Load Campaigns database (excluding segments as they load separately below)
  const loadData = async () => {
    setLoading(true);
    try {
      const camps = await api.getCampaigns();
      setCampaigns(camps);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch campaigns database");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch segments when composer mounts
  useEffect(() => {
    const loadSegments = async () => {
      try {
        setSegmentsLoading(true);
        const data = await api.getSegments();
        const segs = Array.isArray(data) ? data : [];
        setSegments(segs);

        // Handle Segment pre-selection if segment_id is in query parameters
        if (preSelectedSegmentId) {
          const found = segs.find(s => s.id === preSelectedSegmentId);
          if (found) {
            setSelectedSegmentId(found.id);
            setSelectedSegment(found);
          }
        }
      } catch (e) {
        console.error("Failed to load segments:", e);
        setSegments([]);
      } finally {
        setSegmentsLoading(false);
      }
    };
    loadSegments();
  }, [preSelectedSegmentId]);

  // Handle live query suggestions streaming inline in Step 1
  const handleAiSuggest = async () => {
    if (!aiGoal.trim()) return;

    setAiLoading(true);
    setAiResult(null);
    setAiError("");
    setStreamedText("");

    try {
      const response = await api.streamSegmentSuggest(aiGoal);

      if (!response.body) {
        throw new Error("No response body from AI endpoint");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6).trim());

            if (data.text) {
              setStreamedText(prev => prev + data.text);
            }

            if (data.error) {
              setAiError(data.error);
              setAiLoading(false);
              return;
            }

            if (data.done && data.result) {
              setAiResult(data.result);
              // Auto-create a temporary segment object so user can proceed
              const tempSegment = {
                id: `ai_temp_${Date.now()}`,
                name: data.result.audience_name,
                description: data.result.rationale,
                rule_json: data.result.rules,
                estimated_count: data.result.estimated_count,
                created_at: new Date().toISOString(),
              };
              setSelectedSegment(tempSegment);
              setAiLoading(false);
            }
          } catch (parseErr) {
            // Skip malformed SSE lines
            continue;
          }
        }
      }
    } catch (e: any) {
      setAiError(e.message || "AI suggestion failed — check backend is running");
      console.error("AI suggest error:", e);
    } finally {
      setAiLoading(false);
    }
  };

  // Generate Message draft streaming
  const handleGenerateDraft = async () => {
    if (!selectedSegment) {
      toast.error("No target segment selected");
      return;
    }
    setGeneratingDraft(true);
    setDraftText("");
    setEditableMessage("");

    try {
      const response = await api.streamMessageDraft({
        audience_name: selectedSegment.name,
        channel: selectedChannel,
        objective: objective,
        brand_tone: TONE_MAP[selectedTone] || "warm and premium",
        segment_rules: selectedSegment.rule_json
      });

      if (!response.body) throw new Error("No stream body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6).trim());
            if (data.text) {
              setDraftText(prev => {
                const updated = prev + data.text;
                // prefill editor dynamically as it streams
                setEditableMessage(updated);
                return updated;
              });
            }
            if (data.done) {
              setEditableMessage(data.full_message);
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Copy generation failed");
    } finally {
      setGeneratingDraft(false);
    }
  };

  // Launch Campaign
  const handleLaunch = async () => {
    if (!campaignName.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    setLaunching(true);
    try {
      // Create campaign
      const campaign = await api.createCampaign({
        name: campaignName,
        objective: objective,
        segment_id: selectedSegmentId,
        channel: selectedChannel,
        message_template: editableMessage
      });

      // Dispatch campaign broadcast trigger
      await api.sendCampaign(campaign.id);

      toast.success("🚀 Campaign launched! Callbacks arriving shortly...");
      
      // Delay navigation
      setTimeout(() => {
        router.push(`/campaigns/${campaign.id}`);
      }, 1500);

    } catch (err) {
      console.error(err);
      toast.error("Launch campaign failure");
      setLaunching(false);
    }
  };

  // View campaign detailed metrics modal
  const handleViewDetails = async (id: string) => {
    setSelectedCampaignId(id);
    setDetailLoading(true);
    try {
      const [detail, funnel] = await Promise.all([
        api.getCampaignById(id),
        api.getCampaignFunnel(id)
      ]);
      setCampaignDetail(detail);
      setFunnelData(funnel.funnel);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load details");
      setSelectedCampaignId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Render Highlighted `{first_name}` copy snippet
  const renderHighlightedMessage = (text: string) => {
    const highlighted = text.replace(
      /\{first_name\}/g,
      '<span class="text-accent-purple font-medium">{first_name}</span>'
    );
    return { __html: highlighted };
  };

  // Delivery Rate styles mapper
  const getDeliveryColorClass = (rate: number) => {
    if (rate > 80) return "text-accent-green bg-accent-green/10 border border-accent-green/20";
    if (rate >= 50) return "text-accent-amber bg-accent-amber/10 border border-accent-amber/20";
    return "text-accent-red bg-accent-red/10 border border-accent-red/20";
  };

  // Cancel Wizard reset
  const handleCancelComposer = () => {
    setCurrentStep(0);
    setSelectedSegmentId("");
    setSelectedSegment(null);
    setAiGoal("");
    setAiResult(null);
    setAiError("");
    setStreamedText("");
    setObjective("Reactivate lapsed VIP customers");
    setSelectedTone("Warm");
    setDraftText("");
    setEditableMessage("");
    setSelectedChannel("whatsapp");
    setCampaignName("");
    // Close route params
    router.push("/campaigns");
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-y-auto">
      {!isNewCampaign ? (
        /* MODE 1: CAMPAIGNS LIST VIEW */
        <>
          <PageHeader
            title="Campaigns"
            description="Manage marketing broadcasts and track engagement rates"
            action={
              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-border-default bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => router.push("/campaigns?new=true")}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-accent-purple hover:bg-accent-purple/95 text-text-primary text-xs font-semibold shadow-lg shadow-accent-purple/20 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Campaign</span>
                </button>
              </div>
            }
          />

          <div className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyState
                icon={<Megaphone className="h-8 w-8" />}
                title="No campaigns yet"
                description="Design your first broadcast message flow to begin outreach."
                action={
                  <button
                    onClick={() => router.push("/campaigns?new=true")}
                    className="px-5 py-2.5 bg-accent-purple hover:bg-accent-purple/95 rounded-lg text-text-primary text-xs font-bold shadow-md cursor-pointer"
                  >
                    Create your first campaign →
                  </button>
                }
              />
            ) : (
              <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-subtle text-[11px] font-bold text-text-secondary uppercase tracking-wider bg-bg-tertiary/20">
                        <th className="py-3.5 px-6">Campaign</th>
                        <th className="py-3.5 px-6">Channel</th>
                        <th className="py-3.5 px-6">Status</th>
                        <th className="py-3.5 px-6">Audience Size</th>
                        <th className="py-3.5 px-6">Delivered %</th>
                        <th className="py-3.5 px-6">Launched Date</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle text-xs">
                      {campaigns.map((c) => {
                        const isLaunched = c.status === "launched" || c.status === "sent";
                        const deliveryRate = c.sent ? Math.round(((c.delivered || 0) / c.sent) * 100) : 0;
                        return (
                          <tr key={c.id} className="hover:bg-bg-tertiary/20 transition-colors">
                            <td className="py-4 px-6">
                              <div className="font-semibold text-text-primary text-[13px]">{c.name}</div>
                              <div className="text-[11px] text-text-secondary mt-0.5 line-clamp-1 max-w-sm">{c.objective}</div>
                            </td>
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-900 border border-border-default text-text-secondary text-[11px] font-medium capitalize">
                                {c.channel === "whatsapp" ? "📱" : c.channel === "email" ? "✉️" : "💬"} {c.channel}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <StatusBadge status={c.status} />
                            </td>
                            <td className="py-4 px-6 text-text-secondary font-medium">
                              {c.audience_size.toLocaleString()}
                            </td>
                            <td className="py-4 px-6">
                              {isLaunched ? (
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${getDeliveryColorClass(deliveryRate)}`}>
                                  {deliveryRate}%
                                </span>
                              ) : (
                                <span className="text-text-tertiary font-medium">-</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-text-secondary">
                              {c.launched_at ? new Date(c.launched_at).toLocaleDateString() : <span className="text-text-tertiary">Draft</span>}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <Link
                                href={`/campaigns/${c.id}`}
                                className="text-accent-purple hover:text-accent-purple/80 font-semibold cursor-pointer"
                              >
                                View →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* MODE 2: CAMPAIGN COMPOSER (4-STEP WIZARD) */
        <>
          <div className="px-8 py-5 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCancelComposer}
                className="h-8 w-8 rounded-lg border border-border-default hover:bg-bg-tertiary flex items-center justify-center text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-text-primary">New Campaign Composer</h1>
                <p className="text-[11px] text-text-secondary">AI-Native Outbound Marketing Setup</p>
              </div>
            </div>
            <button
              onClick={handleCancelComposer}
              className="text-xs text-text-tertiary hover:text-text-primary font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <StepIndicator steps={COMPOSER_STEPS} currentStep={currentStep} />

          <div className="flex-1 p-8 max-w-4xl w-full mx-auto space-y-8">
            
            {/* STEP 1: CHOOSE AUDIENCE */}
            {currentStep === 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-200">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-text-primary">Step 1: Define Target Audience</h2>
                  <p className="text-xs text-text-secondary">Pick a predefined behavioral segment or generate a new one instantly with AI Suggest.</p>
                </div>

                {!selectedSegment ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Option A: Saved dropdown selection */}
                    <div className="rounded-xl border border-border-default bg-bg-secondary p-5 space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Option A</span>
                        <h3 className="text-[13px] font-bold text-text-primary">Pick Saved Segment</h3>
                      </div>
                      <select
                        value={selectedSegmentId}
                        onChange={e => {
                          const seg = segments.find(s => s.id === e.target.value)
                          setSelectedSegmentId(e.target.value)
                          setSelectedSegment(seg || null)
                        }}
                        disabled={segmentsLoading}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          background: "#1A1A1A",
                          border: "1px solid #2A2A2A",
                          borderRadius: "8px",
                          color: segmentsLoading ? "#555555" : "#F2F2F2",
                          fontSize: "14px",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">
                          {segmentsLoading ? "Loading segments..." : segments.length === 0 ? "No segments yet — create one first" : "Select segment..."}
                        </option>
                        {segments.map(seg => (
                          <option key={seg.id} value={seg.id}>
                            {seg.name} · {seg.estimated_count} customers
                          </option>
                        ))}
                      </select>
                      {!segmentsLoading && segments.length === 0 && (
                        <p style={{ fontSize: 12, color: "#F59E0B", marginTop: 8 }}>
                          ⚠ No segments found.{" "}
                          <a href="/segments" style={{ color: "#8B5CF6", textDecoration: "underline" }}>
                            Create a segment first →
                          </a>
                        </p>
                      )}
                    </div>

                    {/* Option B: Inline Quick AI suggest */}
                    <div className="rounded-xl border border-border-default bg-bg-secondary p-5 space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Option B</span>
                        <h3 className="text-[13px] font-bold text-text-primary">Quick AI Suggest</h3>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={aiGoal}
                          onChange={(e) => setAiGoal(e.target.value)}
                          placeholder="e.g. Inactive buyers with spend > 5000 in Mumbai"
                          className="w-full rounded-lg border border-border-default bg-neutral-900/60 px-3 py-2 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-purple"
                        />
                        <button
                          type="button"
                          onClick={handleAiSuggest}
                          disabled={aiLoading || !aiGoal.trim()}
                          style={{
                            width: "100%",
                            padding: "10px 16px",
                            background: aiLoading || !aiGoal.trim() ? "#2A2A2A" : "#8B5CF6",
                            color: aiLoading || !aiGoal.trim() ? "#555555" : "#FFFFFF",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "14px",
                            fontWeight: 500,
                            cursor: aiLoading || !aiGoal.trim() ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                          }}
                        >
                          {aiLoading ? (
                            <>
                              <span style={{
                                width: 14,
                                height: 14,
                                border: "2px solid #555",
                                borderTopColor: "#8B5CF6",
                                borderRadius: "50%",
                                display: "inline-block",
                                animation: "spin 0.8s linear infinite",
                              }} />
                              Thinking...
                            </>
                          ) : (
                            "Suggest Segment →"
                          )}
                        </button>

                        <style>{`
                          @keyframes spin {
                            to { transform: rotate(360deg); }
                          }
                        `}</style>

                        {aiResult && (
                          <div style={{
                            marginTop: 16,
                            padding: "14px 16px",
                            background: "#0D0D1A",
                            border: "1px solid #4C1D95",
                            borderLeft: "3px solid #8B5CF6",
                            borderRadius: "8px",
                          }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#F2F2F2", margin: "0 0 4px" }}>
                              ✦ {aiResult.audience_name}
                            </p>
                            <p style={{ fontSize: 12, color: "#888888", margin: "0 0 8px" }}>
                              {aiResult.rationale}
                            </p>
                            <p style={{ fontSize: 12, color: "#10B981", margin: 0 }}>
                              {aiResult.estimated_count} customers match · Rules applied ↓
                            </p>
                          </div>
                        )}

                        {aiError && (
                          <div style={{
                            marginTop: 12,
                            padding: "10px 14px",
                            background: "#2A1010",
                            border: "1px solid #EF4444",
                            borderRadius: "8px",
                            fontSize: 12,
                            color: "#EF4444",
                          }}>
                            ⚠ {aiError}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Summary Card of selected segment */
                  <div className="p-6 rounded-xl border border-accent-purple/20 bg-bg-highlight/5 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-accent-purple tracking-widest block">Selected Audience</span>
                        <h3 className="text-base font-bold text-text-primary mt-1">{selectedSegment.name}</h3>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedSegment(null);
                          setSelectedSegmentId("");
                        }}
                        className="text-xs text-accent-purple hover:text-accent-purple/85 font-semibold cursor-pointer underline"
                      >
                        Change segment
                      </button>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-text-secondary">
                      <span>Matched Shoppers: <strong className="text-text-primary">{selectedSegment.estimated_count}</strong></span>
                      <span>&bull;</span>
                      <span>Created: {selectedSegment.created_at ? new Date(selectedSegment.created_at).toLocaleDateString() : "Live AI"}</span>
                    </div>

                    {/* Rule tags */}
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border-subtle">
                      {Object.entries(selectedSegment.rule_json || {}).map(([key, val]) => {
                        let label = "";
                        if (key === "last_order_days_gt") label = `${val}+ days inactive`;
                        else if (key === "total_spend_gt") label = `Spend > ₹${val}`;
                        else if (key === "order_count_gte") label = `${val}+ orders`;
                        else if (key === "cities") label = Array.isArray(val) ? val.join(", ") : val;
                        else if (key === "preferred_channels") label = Array.isArray(val) ? val.join(", ") : val;
                        return label ? (
                          <span key={key} className="px-2 py-0.5 rounded bg-bg-tertiary border border-border-default text-[10px] text-text-secondary font-medium uppercase">
                            {label}
                          </span>
                        ) : null;
                      })}
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="flex items-center gap-1 bg-accent-purple hover:bg-accent-purple/95 px-5 py-2.5 rounded-lg text-text-primary text-xs font-bold shadow-md cursor-pointer"
                      >
                        <span>Next: Write Message</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: WRITE MESSAGE WITH AI */}
            {currentStep === 1 && selectedSegment && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-200">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-text-primary">Step 2: Write Message copy</h2>
                  <p className="text-xs text-text-secondary">Use Gemini to generate a message optimized for tone and channel constraints.</p>
                </div>

                {/* AI Generate Section */}
                <div className="rounded-xl border border-border-default bg-bg-secondary p-5 space-y-4">
                  <div className="flex items-center space-x-2 pb-1 border-b border-border-subtle">
                    <span className="text-accent-purple text-xs">✦</span>
                    <h3 className="text-[13px] font-bold text-text-primary">AI Copywriter Generator</h3>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Campaign Objective</label>
                      <input
                        type="text"
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        placeholder="Reactivate lapsed VIP customers"
                        className="rounded-lg border border-border-default bg-neutral-900/60 px-3 py-2 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-purple"
                      />
                    </div>

                    <div className="flex flex-col space-y-2">
                      <label className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Brand Tone</label>
                      <div className="flex gap-2">
                        {TONES.map(tone => {
                          const isSelected = selectedTone === tone;
                          return (
                            <button
                              type="button"
                              key={tone}
                              onClick={() => setSelectedTone(tone)}
                              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                isSelected 
                                  ? "bg-accent-purple border-accent-purple text-text-primary" 
                                  : "border-border-default bg-neutral-900/40 text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              {tone}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateDraft}
                      disabled={generatingDraft || !objective.trim()}
                      className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg bg-accent-purple/15 hover:bg-accent-purple/25 border border-accent-purple/35 text-accent-purple text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {generatingDraft ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      <span>Generate Draft →</span>
                    </button>
                  </div>
                </div>

                {/* Message Preview */}
                <div className="rounded-xl border border-border-default bg-bg-secondary p-5 space-y-3">
                  <h3 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Preview</h3>
                  <div className="p-4 rounded-lg bg-neutral-950 border border-border-subtle min-h-[80px]">
                    {generatingDraft && !draftText ? (
                      <div className="flex items-center space-x-2 text-xs text-text-tertiary">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent-purple" />
                        <span>AI copywriter is drafting...</span>
                      </div>
                    ) : (
                      <div 
                        className="text-xs text-text-primary leading-relaxed break-words whitespace-pre-wrap font-sans"
                        dangerouslySetInnerHTML={renderHighlightedMessage(generatingDraft ? draftText : editableMessage)}
                      />
                    )}
                  </div>
                </div>

                {/* Editable Text Area */}
                <div className="flex flex-col space-y-2">
                  <label className="text-[11px] text-text-secondary font-bold uppercase tracking-wider">Edit Draft Copy</label>
                  <textarea
                    rows={4}
                    value={editableMessage}
                    onChange={(e) => setEditableMessage(e.target.value)}
                    placeholder="Message content template..."
                    className="rounded-lg border border-border-default bg-neutral-900/40 px-3 py-2 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-purple font-mono whitespace-pre-wrap leading-relaxed"
                  />
                  <div className="flex justify-between items-center text-[10px] text-text-tertiary">
                    <span>Use <code className="text-accent-purple font-bold font-mono">{`{first_name}`}</code> for user personalization.</span>
                    <span className="font-semibold">
                      Character count: <span className={editableMessage.length > 200 ? "text-accent-red" : "text-text-secondary"}>{editableMessage.length}</span> / 200 (for whatsapp)
                    </span>
                  </div>
                </div>

                {/* Step Actions */}
                <div className="flex justify-between pt-4 border-t border-border-subtle">
                  <button
                    onClick={() => setCurrentStep(0)}
                    className="px-4 py-2 border border-border-default hover:bg-bg-tertiary rounded-lg text-text-secondary hover:text-text-primary text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setCurrentStep(2)}
                    disabled={!editableMessage.trim()}
                    className="flex items-center gap-1 bg-accent-purple hover:bg-accent-purple/95 px-5 py-2.5 rounded-lg disabled:opacity-50 text-text-primary text-xs font-bold shadow-md cursor-pointer"
                  >
                    <span>Next: Choose Channel</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CHOOSE CHANNEL */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-200">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-text-primary">Step 3: Choose Broadcast Channel</h2>
                  <p className="text-xs text-text-secondary">Select the delivery network and name your outreach campaign.</p>
                </div>

                {/* Side-by-side Channel Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  {CHANNEL_CARDS.map(card => {
                    const isSelected = selectedChannel === card.id;
                    return (
                      <div
                        key={card.id}
                        onClick={() => setSelectedChannel(card.id)}
                        className={`rounded-xl border p-5 space-y-3 cursor-pointer transition-all hover:scale-[1.01] ${
                          isSelected 
                            ? "border-accent-purple bg-bg-highlight/30 shadow-md shadow-accent-purple/5" 
                            : "border-border-default bg-bg-secondary hover:border-border-strong"
                        }`}
                      >
                        <span className="text-2xl block">{card.icon}</span>
                        <div>
                          <h4 className="text-xs font-bold text-text-primary tracking-wide">{card.name}</h4>
                          <p className="text-[10px] text-text-secondary mt-1 font-medium">{card.rate} delivery rate</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Campaign Name Input */}
                <div className="flex flex-col space-y-1 pt-2">
                  <label className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Campaign Name</label>
                  <input
                    type="text"
                    required
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. VIP Glow Winback Broadcast"
                    className="rounded-lg border border-border-default bg-neutral-900/60 px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-purple"
                  />
                </div>

                {/* Step Actions */}
                <div className="flex justify-between pt-4 border-t border-border-subtle">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-4 py-2 border border-border-default hover:bg-bg-tertiary rounded-lg text-text-secondary hover:text-text-primary text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    disabled={!campaignName.trim()}
                    className="flex items-center gap-1 bg-accent-purple hover:bg-accent-purple/95 px-5 py-2.5 rounded-lg disabled:opacity-50 text-text-primary text-xs font-bold shadow-md cursor-pointer"
                  >
                    <span>Next: Review & Launch</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: LAUNCH REVIEW */}
            {currentStep === 3 && selectedSegment && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-200">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-text-primary">Step 4: Campaign Review & Launch</h2>
                  <p className="text-xs text-text-secondary">Please verify details before executing the outbound broadcast.</p>
                </div>

                {/* Campaign Summary panel */}
                <div className="rounded-xl border border-border-default bg-bg-secondary p-6 shadow-xl space-y-4">
                  <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider border-b border-border-subtle pb-2">
                    Campaign Summary
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Campaign Name:</span>
                      <span className="font-semibold text-text-primary">{campaignName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Target Segment:</span>
                      <span className="font-semibold text-text-primary">{selectedSegment.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Audience Size:</span>
                      <span className="font-semibold text-accent-purple">{selectedSegment.estimated_count} customers</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Broadcast Channel:</span>
                      <span className="font-semibold text-text-primary capitalize">{selectedChannel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Campaign Objective:</span>
                      <span className="font-semibold text-text-secondary italic">{objective}</span>
                    </div>

                    <div className="pt-3 border-t border-border-subtle flex flex-col space-y-1.5">
                      <span className="text-text-secondary">Message Copy:</span>
                      <pre className="p-3 bg-neutral-950 border border-border-subtle rounded-lg text-[11px] leading-relaxed text-text-secondary font-mono whitespace-pre-wrap break-words">
                        {editableMessage}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Step Actions */}
                <div className="flex justify-between pt-4 border-t border-border-subtle">
                  <button
                    onClick={() => setCurrentStep(2)}
                    disabled={launching}
                    className="px-4 py-2 border border-border-default hover:bg-bg-tertiary rounded-lg text-text-secondary hover:text-text-primary text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Back
                  </button>

                  <button
                    onClick={handleLaunch}
                    disabled={launching}
                    className="flex items-center space-x-2 px-6 py-3 bg-accent-purple hover:bg-accent-purple/95 disabled:opacity-50 text-text-primary text-xs font-bold rounded-lg shadow-lg shadow-accent-purple/25 transition-all cursor-pointer"
                  >
                    {launching ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Launching...</span>
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4" />
                        <span>Launch Campaign</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </>
      )}

      {/* CAMPAIGN METRICS DRAWER / MODAL */}
      {selectedCampaignId && (
        <div className="fixed inset-0 bg-[#000]/60 backdrop-blur-sm flex items-center justify-end z-50 animate-in fade-in duration-200">
          <div className="h-full w-full max-w-xl bg-bg-secondary border-l border-border-default flex flex-col p-6 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-250">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div className="flex items-center space-x-3">
                <span className="h-8 w-8 rounded-lg bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center text-accent-purple">
                  <Megaphone className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="font-bold text-text-primary text-sm">
                    {detailLoading ? "Loading details..." : campaignDetail?.name}
                  </h3>
                  <span className="text-[10px] text-text-secondary block capitalize mt-0.5 font-medium">
                    {campaignDetail?.channel} Campaign &bull; {campaignDetail?.status}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCampaignId(null)}
                className="h-7 w-7 rounded-lg hover:bg-bg-tertiary flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="h-6 w-6 text-accent-purple animate-spin" />
                <span className="text-text-tertiary text-xs">Fetching campaign analytics...</span>
              </div>
            ) : campaignDetail ? (
              <div className="flex-1 space-y-6 pt-6 text-xs">
                
                {/* Rate Metrics Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border-default bg-neutral-900/30 p-4 text-center">
                    <span className="text-[9px] text-text-secondary font-bold block uppercase tracking-wider">Delivery Rate</span>
                    <span className="text-xl font-bold text-text-primary mt-1 block">
                      {campaignDetail.analytics.delivery_rate}%
                    </span>
                  </div>
                  <div className="rounded-xl border border-border-default bg-neutral-900/30 p-4 text-center">
                    <span className="text-[9px] text-text-secondary font-bold block uppercase tracking-wider">Open Rate</span>
                    <span className="text-xl font-bold text-text-primary mt-1 block">
                      {campaignDetail.analytics.open_rate}%
                    </span>
                  </div>
                  <div className="rounded-xl border border-border-default bg-neutral-900/30 p-4 text-center">
                    <span className="text-[9px] text-text-secondary font-bold block uppercase tracking-wider">Click Rate</span>
                    <span className="text-xl font-bold text-text-primary mt-1 block">
                      {campaignDetail.analytics.click_rate}%
                    </span>
                  </div>
                </div>

                {/* Funnel chart list */}
                <div className="rounded-xl border border-border-default bg-neutral-900/30 p-5 space-y-4">
                  <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider block">Engagement Funnel Flow</span>
                  <div className="space-y-3">
                    {funnelData.map((stage, idx) => {
                      const totalCount = funnelData[0]?.count || 1;
                      const percentage = Math.round((stage.count / totalCount) * 100);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-text-secondary">{stage.stage}</span>
                            <span className="font-bold text-text-primary">
                              {stage.count} <span className="text-text-tertiary font-medium ml-1">({percentage}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-neutral-950 overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-blue"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Template Content */}
                <div className="rounded-xl border border-border-default bg-neutral-900/30 p-5 space-y-2">
                  <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider block">Message Copy Template</span>
                  <pre className="p-3 bg-neutral-950 border border-border-subtle rounded-lg font-mono text-[10px] leading-relaxed text-text-secondary overflow-x-auto whitespace-pre-wrap break-words">
                    {campaignDetail.message_template}
                  </pre>
                </div>

                {/* Recipients listing logs */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider block">Delivery & Event Logs</span>
                  <div className="divide-y divide-border-subtle max-h-[200px] overflow-y-auto pr-1 border border-border-default rounded-xl bg-neutral-900/30 px-3">
                    {campaignDetail.recipients.map((rec) => (
                      <div key={rec.id} className="py-2.5 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-bold text-text-primary block">{rec.customer_name}</span>
                          <span className="text-[10px] text-text-tertiary block">{rec.email || "Deliverable"}</span>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold capitalize ${
                            rec.current_status === "clicked" 
                              ? "bg-accent-green/10 text-accent-green" 
                              : rec.current_status === "failed" 
                              ? "bg-accent-red/10 text-accent-red" 
                              : "bg-neutral-900 text-text-secondary"
                          }`}>
                            {rec.current_status}
                          </span>
                          {rec.last_event_time && (
                            <span className="text-[9px] text-text-tertiary block mt-0.5 font-mono">
                              {new Date(rec.last_event_time).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-4 bg-bg-primary">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    }>
      <CampaignsContent />
    </Suspense>
  );
}
