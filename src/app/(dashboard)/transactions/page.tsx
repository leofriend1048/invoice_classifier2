"use client"
import { getColumns } from "@/app/(dashboard)/transactions/_components/Columns"
import { DataTable } from "@/app/(dashboard)/transactions/_components/DataTable"
import { DataTableDrawer } from "@/app/(dashboard)/transactions/_components/DataTableDrawer"
import { Invoice } from "@/data/schema"
import { createClient } from "@supabase/supabase-js"
import { Row } from "@tanstack/react-table"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { DataTableBulkEditor } from "./_components/TableBulkEditor"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function Example() {
  const [row, setRow] = useState<Row<Invoice> | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [tableInstance, setTableInstance] = useState<any>(null)
  const datas = row?.original

  useEffect(() => {
    let ignore = false

    async function fetchInvoices() {
      setLoading(true)
      const { data, error } = await supabase
        .from("invoice_class_invoices")
        .select("*")
        .order("invoice_date", { ascending: false })
      if (!error && data && !ignore) {
        setInvoices(data as Invoice[])
      }
      setLoading(false)
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

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
        Invoices
      </h1>
      <div className="mt-4 sm:mt-6 lg:mt-10">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
            <span className="ml-3 text-lg text-gray-700 dark:text-gray-200">Loading invoices...</span>
          </div>
        ) : (
          <DataTable
            data={invoices}
            columns={columns}
            onRowClick={(row) => {
              setRow(row)
              setIsOpen(true)
            }}
            onEditClick={(row) => {
              setRow(row)
              setIsOpen(true)
            }}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onTableReady={setTableInstance}
          />
        )}
        <DataTableDrawer open={isOpen} onOpenChange={setIsOpen} datas={datas} />
      </div>
      {/* Command bar always at bottom of page */}
      {tableInstance && (
        <DataTableBulkEditor table={tableInstance} rowSelection={rowSelection} />
      )}
    </>
  )
}
