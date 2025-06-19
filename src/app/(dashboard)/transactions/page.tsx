"use client"
import { getColumns } from "@/app/(dashboard)/transactions/_components/Columns"
import { DataTable } from "@/app/(dashboard)/transactions/_components/DataTable"
import { DataTableDrawer } from "@/app/(dashboard)/transactions/_components/DataTableDrawer"
import { Invoice } from "@/data/schema"
import { createClient } from "@supabase/supabase-js"
import { Row } from "@tanstack/react-table"
import { AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { DataTableBulkEditor } from "./_components/TableBulkEditor"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Table skeleton loading component
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {/* Filter bar skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="flex space-x-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </div>

      {/* Table header skeleton */}
      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-800 pb-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        ))}
      </div>

      {/* Table rows skeleton */}
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4 py-3">
          {Array.from({ length: 8 }).map((_, colIndex) => (
            <div key={colIndex} className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      ))}

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between pt-4">
        <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="flex space-x-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Example() {
  const [row, setRow] = useState<Row<Invoice> | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [tableInstance, setTableInstance] = useState<any>(null)
  const datas = row?.original

  useEffect(() => {
    let ignore = false

    async function fetchInvoices() {
      try {
        setLoading(true)
        setError(null)
        const { data, error: fetchError } = await supabase
          .from("invoice_class_invoices")
          .select("*")
          .order("invoice_date", { ascending: false })

        if (fetchError) {
          throw fetchError
        }

        if (data && !ignore) {
          setInvoices(data as Invoice[])
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load invoices')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    fetchInvoices()

    // Subscribe to realtime changes
    const channel = supabase
      .channel("public:invoice_class_invoices")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoice_class_invoices" },
        (payload) => {
          setInvoices((prev) => {
            if (payload.eventType === "INSERT") {
              // Avoid duplicates
              if (prev.some(inv => inv.id === payload.new.id)) return prev
              return [payload.new as Invoice, ...prev]
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((inv) =>
                inv.id === payload.new.id ? (payload.new as Invoice) : inv
              )
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((inv) => inv.id !== payload.old.id)
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
  }, [])

  const columns = getColumns({
    onEditClick: (row) => {
      setRow(row)
      setIsOpen(true)
    },
  })

  // Error state
  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-2">
          Failed to load invoices
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
        Invoices
      </h1>
      <div className="mt-4 sm:mt-6 lg:mt-10">
        {loading ? (
          <TableSkeleton />
        ) : (
          <DataTable
            data={invoices}
            columns={columns}
            onTableReady={setTableInstance}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
          />
        )}
        <DataTableDrawer open={isOpen} onOpenChange={setIsOpen} datas={datas} />
      </div>
      {/* Command bar always at bottom of page */}
      {tableInstance && !loading && (
        <DataTableBulkEditor table={tableInstance} rowSelection={rowSelection} />
      )}
    </>
  )
}
