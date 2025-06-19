"use client"

import { Invoice } from "@/data/schema"
import { createClient } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import Header from "./_components/Header"
import { InvoiceChart } from "./_components/TransactionChart"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Header skeleton that matches the actual header structure
function HeaderSkeleton() {
  return (
    <section className="sticky top-16 z-50 -my-6 flex flex-col gap-6 bg-white py-6 md:flex-row md:flex-wrap md:items-center md:justify-between lg:top-0 dark:bg-gray-925">
      <div className="space-y-1">
        <div className="h-6 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Mobile accordion skeleton */}
      <div className="block md:hidden">
        <div className="h-10 w-20 animate-pulse rounded-md border bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Desktop filters skeleton */}
      <div className="hidden items-end gap-3 md:flex md:flex-wrap">
        <div className="h-10 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-10 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-10 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-10 w-36 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-10 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    </section>
  )
}

// Chart skeleton that matches the exact chart structure
function ChartSkeleton({ layout = "horizontal", className = "" }: { layout?: "horizontal" | "vertical", className?: string }) {
  return (
    <div className={`w-full ${className}`}>
      {/* Chart header with title and info icon */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      {/* Large value display */}
      <div className="mt-2 h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />

      {/* Chart area */}
      <div className="mt-6">
        {layout === "vertical" ? (
          <div className="h-48 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                <div
                  className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800"
                  style={{ width: `${Math.random() * 150 + 80}px` }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="h-48 flex items-end justify-center space-x-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-gray-200 dark:bg-gray-800 animate-pulse rounded-t"
                style={{
                  width: '20px',
                  height: `${Math.random() * 120 + 30}px`
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Complete reports skeleton that matches the page structure
function ReportsPageSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <section className="my-8">
        <div className="space-y-12">
          {/* Amount chart - desktop */}
          <ChartSkeleton className="hidden sm:block" />

          {/* Amount chart - mobile */}
          <ChartSkeleton className="sm:hidden" />

          {/* Count chart - desktop */}
          <ChartSkeleton className="hidden sm:block" />

          {/* Count chart - mobile */}
          <ChartSkeleton className="sm:hidden" />

          {/* Grid with category and merchant charts */}
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20">
            <ChartSkeleton layout="vertical" />
            <ChartSkeleton layout="vertical" />
          </div>
        </div>
      </section>
    </>
  )
}

export default function Page() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    async function fetchInvoices() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("invoice_class_invoices")
          .select("*")
          .eq("status", "approved")
          .order("invoice_date", { ascending: false })

        if (!error && data && !ignore) {
          setInvoices(data as Invoice[])
        }
      } catch (err) {
        console.error("Failed to fetch invoices:", err)
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    fetchInvoices()
    return () => { ignore = true }
  }, [])

  // Show skeleton loading that matches the exact page structure
  if (loading) {
    return <ReportsPageSkeleton />
  }

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
