import { createClient } from "@supabase/supabase-js"
import { Card, Text, Title, Badge as TremorBadge } from "@tremor/react"
import { useEffect, useState } from "react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function formatDate(dateString: string) {
  if (!dateString) return "-"
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleString()
}

function humanizeAction(action: string) {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function DataTableDrawerFeed({ invoiceId }: { invoiceId: string }) {
  const [auditTrail, setAuditTrail] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!invoiceId) return
    setLoading(true)
    let ignore = false
    async function fetchAuditTrail() {
      const { data, error } = await supabase
        .from("invoice_class_invoice_audit_trail")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("performed_at", { ascending: false })
      if (!error && data && !ignore) setAuditTrail(data)
      setLoading(false)
    }
    fetchAuditTrail()

    // Subscribe to realtime changes for this invoice's audit trail
    const channel = supabase
      .channel("public:invoice_class_invoice_audit_trail")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoice_class_invoice_audit_trail", filter: `invoice_id=eq.${invoiceId}` },
        (payload) => {
          setAuditTrail((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new, ...prev]
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((entry) => entry.id === payload.new.id ? payload.new : entry)
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((entry) => entry.id !== payload.old.id)
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      ignore = true
      supabase.removeChannel(channel)
    }
  }, [invoiceId])

  return (
    <Card className="bg-white dark:bg-gray-925">
      <Title>Audit Trail</Title>
      {loading ? (
        <Text>Loading...</Text>
      ) : auditTrail.length === 0 ? (
        <Text>No audit trail entries for this invoice.</Text>
      ) : (
        <div className="flex flex-col gap-0.5 border-l-2 border-tremor-border dark:border-tremor-border-dark pl-4">
          {auditTrail.map((entry) => {
            const details = typeof entry.details === 'string' ? (() => { try { return JSON.parse(entry.details) } catch { return {} } })() : entry.details || {}
            // Find changed fields for before/after
            let changedFields: Array<{ key: string, before: any, after: any }> = []
            if (details.before && details.after) {
              changedFields = Object.keys(details.after).filter(key => details.before[key] !== details.after[key])
                .map(key => ({ key, before: details.before[key], after: details.after[key] }))
            }
            return (
              <div key={entry.id} className="relative mb-6">
                {/* Timeline dot */}
                <div className="absolute -left-5 top-1.5 h-3 w-3 rounded-full bg-blue-500 border-2 border-white dark:border-gray-925" />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <TremorBadge color="blue">{entry.performed_by || "System"}</TremorBadge>
                    <span className="text-xs text-gray-500">{formatDate(entry.performed_at)}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {humanizeAction(entry.action)}
                  </div>
                  {changedFields.length > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5 text-xs text-gray-700 dark:text-gray-300">
                      {changedFields.map(({ key, before, after }) => (
                        <div key={key}>
                          <span className="font-semibold">{key.charAt(0).toUpperCase() + key.slice(1)}:</span> {before ? <span className="line-through text-rose-500">{String(before)}</span> : <span className="text-gray-400 italic">empty</span>} <span className="mx-1 text-gray-400">→</span> <span className="text-green-600 font-semibold">{after ? String(after) : <span className="text-gray-400 italic">empty</span>}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {details.comment && (
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">Comment:</span> {details.comment}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
