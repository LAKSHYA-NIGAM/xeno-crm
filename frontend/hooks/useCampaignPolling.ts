import { useState, useEffect, useRef } from "react"
import { api, CampaignDetail } from "@/lib/api"

export function useCampaignPolling(campaignId: string, intervalMs = 5000) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<any>(null)

  const fetchCampaign = async () => {
    try {
      const data = await api.getCampaignById(campaignId)
      setCampaign(data)
      setLoading(false)

      // Stop polling if campaign is completed
      if (data && data.status === "completed") {
        clearInterval(intervalRef.current)
      }
    } catch (e) {
      console.error("Poll failed:", e)
    }
  }

  useEffect(() => {
    fetchCampaign()
    intervalRef.current = setInterval(fetchCampaign, intervalMs)
    return () => clearInterval(intervalRef.current)
  }, [campaignId, intervalMs])

  return { campaign, loading, refetch: fetchCampaign }
}
