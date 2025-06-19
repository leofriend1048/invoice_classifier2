"use client"

import { Invoice } from "@/data/schema"
import { createClient } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import Header from "./_components/Header"
import { InvoiceChart } from "./_components/TransactionChart"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function Page() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    async function fetchInvoices() {
      setLoading(true)
      const { data, error } = await supabase
        .from("invoice_class_invoices")
        .select("*")
        .eq("status", "approved")
        .order("invoice_date", { ascending: false })
      if (!error && data && !ignore) {
        setInvoices(data as Invoice[])
      }
      setLoading(false)
    }
    fetchInvoices()
    return () => { ignore = true }
  }, [])

  return (
    <>
      <Header />
      <section className="my-8">
        <div className="space-y-12">
          <InvoiceChart
            yAxisWidth={70}
            type="amount"
            className="hidden sm:block"
            invoices={invoices}
            isLoading={loading}
          />
          {/* optimized for mobile view */}
          <InvoiceChart
            showYAxis={false}
            type="amount"
            className="sm:hidden"
            invoices={invoices}
            isLoading={loading}
          />
          <InvoiceChart
            yAxisWidth={70}
            type="count"
            className="hidden sm:block"
            invoices={invoices}
            isLoading={loading}
          />
          {/* optimized for mobile view */}
          <InvoiceChart
            showYAxis={false}
            type="count"
            className="sm:hidden"
            invoices={invoices}
            isLoading={loading}
          />
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20">
            <InvoiceChart
              yAxisWidth={100}
              type="category"
              invoices={invoices}
              isLoading={loading}
            />
            <InvoiceChart
              yAxisWidth={100}
              type="merchant"
              invoices={invoices}
              isLoading={loading}
            />
          </div>
        </div>
      </section>
    </>
  )
}
