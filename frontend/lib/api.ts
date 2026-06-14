const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

// Types
export interface Customer {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  city: string
  signup_date: string | null
  preferred_channel: "email" | "whatsapp" | "sms"
  total_spend: number
  last_order_at: string | null
  order_count: number
  created_at: string
}

export interface CustomerStats {
  total_customers: number
  total_revenue: number
  avg_order_value: number
  active_last_30_days: number
}

export interface OverviewStats {
  total_customers: number
  total_revenue: number
  total_orders: number
  active_campaigns: number
  top_cities: { city: string; count: number }[]
  channel_distribution: { channel: string; count: number }[]
  recent_campaigns: Campaign[]
}

export interface Segment {
  id: string
  name: string
  description: string
  rule_json: Record<string, any>
  estimated_count: number
  created_at: string
}

export interface SegmentPreviewResult {
  count: number
  sample_customers: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    city: string
    total_spend: number
    order_count: number
    preferred_channel: string
  }>
}

export interface Campaign {
  id: string
  name: string
  objective: string
  segment_id?: string
  channel: string
  message_template?: string
  status: string
  audience_size: number
  launched_at: string | null
  created_at: string
  sent?: number
  delivered?: number
  failed?: number
  opened?: number
  read?: number
  clicked?: number
  delivery_rate?: number
  open_rate?: number
  click_rate?: number
}

export interface CampaignDetail extends Campaign {
  analytics: {
    audience_size: number
    sent: number
    delivered: number
    failed: number
    opened: number
    read: number
    clicked: number
    delivery_rate: number
    open_rate: number
    click_rate: number
  }
  recipients: Array<{
    id: string
    customer_name: string
    email: string | null
    current_status: string
    last_event_time: string | null
  }>
}

export interface FunnelStage {
  stage: string
  count: number
}

export interface TimelineEvent {
  hour: string
  event_type: string
  count: number
}

export interface AISegmentSuggestion {
  audience_name: string
  rules: Record<string, any>
  rationale: string
  estimated_count: number
}

export interface AIMessageDraft {
  message: string
  channel: string
  audience_name: string
  tone: string
}

// API functions
export const api = {
  getOverview: async () => {
    try {
      const res = await fetch(`${BASE}/analytics/overview`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as OverviewStats
    } catch (e) {
      console.error("getOverview failed:", e)
      return {
        total_customers: 0,
        total_revenue: 0,
        total_orders: 0,
        active_campaigns: 0,
        top_cities: [],
        channel_distribution: [],
        recent_campaigns: [],
      } as OverviewStats
    }
  },

  getSegments: async () => {
    try {
      const res = await fetch(`${BASE}/segments`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as Segment[]
    } catch (e) {
      console.error("getSegments failed:", e)
      return []
    }
  },

  previewSegment: async (rule_json: object) => {
    try {
      const res = await fetch(`${BASE}/segments/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_json }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as SegmentPreviewResult
    } catch (e) {
      console.error("previewSegment failed:", e)
      return { count: 0, sample_customers: [] } as SegmentPreviewResult
    }
  },

  createSegment: async (data: object) => {
    try {
      const res = await fetch(`${BASE}/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as Segment
    } catch (e) {
      console.error("createSegment failed:", e)
      throw e
    }
  },

  getCampaigns: async () => {
    try {
      const res = await fetch(`${BASE}/campaigns`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as Campaign[]
    } catch (e) {
      console.error("getCampaigns failed:", e)
      return []
    }
  },

  getCampaignById: async (id: string) => {
    try {
      const res = await fetch(`${BASE}/campaigns/${id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as CampaignDetail
    } catch (e) {
      console.error("getCampaignById failed:", e)
      return null
    }
  },

  createCampaign: async (data: object) => {
    try {
      const res = await fetch(`${BASE}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as Campaign
    } catch (e) {
      console.error("createCampaign failed:", e)
      throw e
    }
  },

  sendCampaign: async (id: string) => {
    const res = await fetch(
      `${BASE}/campaigns/${id}/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    )
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || "Send failed")
    }
    return res.json()
  },

  getCampaignFunnel: async (id: string) => {
    try {
      const res = await fetch(`${BASE}/analytics/campaigns/${id}/funnel`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as { funnel: FunnelStage[] }
    } catch (e) {
      console.error("getCampaignFunnel failed:", e)
      return { funnel: [] }
    }
  },

  getCampaignTimeline: async (id: string) => {
    try {
      const res = await fetch(`${BASE}/analytics/campaigns/${id}/timeline`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as { timeline: TimelineEvent[] }
    } catch (e) {
      console.error("getCampaignTimeline failed:", e)
      return { timeline: [] }
    }
  },

  streamSegmentSuggest: (goal: string) =>
    fetch(`${BASE}/ai/segment-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    }),

  streamMessageDraft: (data: object) =>
    fetch(`${BASE}/ai/message-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
}

// Backward Compatibility Named Exports
export async function getSegments(): Promise<Segment[]> {
  return api.getSegments()
}

export async function createSegment(body: {
  name: string
  description: string
  rule_json: Record<string, any>
}): Promise<Segment> {
  return api.createSegment(body)
}

export async function previewSegmentRules(rule_json: Record<string, any>): Promise<SegmentPreviewResult> {
  return api.previewSegment(rule_json)
}

export async function suggestSegment(goal: string): Promise<AISegmentSuggestion> {
  try {
    const res = await fetch(`${BASE}/ai/segment-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json() as AISegmentSuggestion
  } catch (e) {
    console.error("suggestSegment failed:", e)
    return {
      audience_name: `AI suggestion for: ${goal.slice(0, 30)}`,
      rules: {},
      rationale: "Backend unavailable — returned safe fallback",
      estimated_count: 0,
    }
  }
}

export async function getCampaigns(): Promise<Campaign[]> {
  return api.getCampaigns()
}

export async function getCampaignById(id: string): Promise<CampaignDetail | null> {
  return api.getCampaignById(id)
}

export async function createCampaign(body: any): Promise<Campaign> {
  return api.createCampaign(body)
}

export async function sendCampaign(id: string): Promise<any> {
  return api.sendCampaign(id)
}

export async function getAnalyticsOverview(): Promise<OverviewStats> {
  return api.getOverview()
}

export async function getCampaignFunnel(id: string): Promise<{ funnel: FunnelStage[] }> {
  return api.getCampaignFunnel(id) as Promise<{ funnel: FunnelStage[] }>
}

export async function getCampaignTimeline(id: string): Promise<{ timeline: TimelineEvent[] }> {
  return api.getCampaignTimeline(id) as Promise<{ timeline: TimelineEvent[] }>
}

export async function draftMessage(body: {
  audience_name: string
  channel: string
  objective: string
  brand_tone?: string
}): Promise<AIMessageDraft> {
  try {
    const res = await fetch(`${BASE}/ai/message-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json() as AIMessageDraft
  } catch (e) {
    console.error("draftMessage failed:", e)
    return {
      message: "Backend unavailable — could not generate draft template.",
      channel: body.channel,
      audience_name: body.audience_name,
      tone: body.brand_tone || "warm",
    }
  }
}
