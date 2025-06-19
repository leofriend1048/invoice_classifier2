"use client"
import { BarChartVariant } from "@/components/BarChartVariant"
import { Tooltip } from "@/components/Tooltip"
import { Invoice } from "@/data/schema"
import { AvailableChartColorsKeys } from "@/lib/chartUtils"
import { cx, formatters } from "@/lib/utils"
import { InfoIcon } from "lucide-react"
import { useQueryState } from "nuqs"
import { useMemo } from "react"
import { DEFAULT_RANGE, RANGE_DAYS, RangeKey } from "./dateRanges"

interface ChartDataItem {
  key: string
  value: number
}

type ChartType = "amount" | "count" | "category" | "merchant"

interface ChartConfig {
  title: string
  tooltipContent: string
  processData: (
    invoices: Invoice[],
    filterDate: Date,
    minAmount: number,
    maxAmount: number
  ) => ChartDataItem[]
  valueFormatter: (value: number) => string
  layout?: "horizontal" | "vertical"
  color: string
  xValueFormatter?: (value: string) => string
}

const chartConfigs: Record<ChartType, ChartConfig> = {
  amount: {
    title: "Total Invoice Amount",
    tooltipContent:
      "Total amount of invoices for the selected period and amount range.",
    color: "blue",
    processData: (invoices, filterDate, minAmount, maxAmount) => {
      const summedData: Record<string, number> = {}
      invoices.forEach((invoice) => {
        const date = invoice.invoice_date.split("T")[0]
        if (isInvoiceValid(invoice, filterDate, minAmount, maxAmount)) {
          summedData[date] = (summedData[date] || 0) + invoice.amount
        }
      })
      const sortedEntries = Object.entries(summedData).sort(([dateA], [dateB]) => {
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      })
      return sortedEntries.map(([date, value]) => ({
        key: date,
        value,
      }))
    },
    valueFormatter: (number: number) =>
      formatters.currency({ number: number, maxFractionDigits: 0 }),
    xValueFormatter: (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
      })
    },
  },
  count: {
    title: "Invoice Count",
    tooltipContent:
      "Total number of invoices for the selected period and amount range.",
    processData: (invoices, filterDate, minAmount, maxAmount) => {
      const countedData: Record<string, number> = {}
      invoices.forEach((invoice) => {
        const date = invoice.invoice_date.split("T")[0]
        if (isInvoiceValid(invoice, filterDate, minAmount, maxAmount)) {
          countedData[date] = (countedData[date] || 0) + 1
        }
      })
      const sortedEntries = Object.entries(countedData).sort(([dateA], [dateB]) => {
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      })
      return sortedEntries.map(([date, value]) => ({
        key: date,
        value,
      }))
    },
    valueFormatter: (number: number) =>
      Intl.NumberFormat("us").format(number).toString(),
    color: "blue",
    xValueFormatter: (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
      })
    },
  },
  category: {
    title: "Top 5 Categories by Invoice Amount",
    tooltipContent:
      "Total amount of invoices for the top 5 categories in the selected period and amount range.",
    processData: (invoices, filterDate, minAmount, maxAmount) => {
      const categoryTotals: Record<string, number> = {}
      invoices.forEach((invoice) => {
        if (isInvoiceValid(invoice, filterDate, minAmount, maxAmount)) {
          if (invoice.category) {
            categoryTotals[invoice.category] =
              (categoryTotals[invoice.category] || 0) + invoice.amount
          }
        }
      })
      return Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([category, value]) => ({ key: category, value }))
    },
    valueFormatter: (number: number) =>
      formatters.currency({ number: number, maxFractionDigits: 0 }),
    layout: "vertical",
    color: "emerald",
  },
  merchant: {
    title: "Top 5 Merchants by Invoice Amount",
    tooltipContent:
      "Total amount of invoices for the top 5 merchants in the selected period and amount range.",
    processData: (invoices, filterDate, minAmount, maxAmount) => {
      const merchantTotals: Record<string, number> = {}
      invoices.forEach((invoice) => {
        if (isInvoiceValid(invoice, filterDate, minAmount, maxAmount)) {
          if (invoice.vendor_name) {
            merchantTotals[invoice.vendor_name] =
              (merchantTotals[invoice.vendor_name] || 0) + invoice.amount
          }
        }
      })
      return Object.entries(merchantTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([merchant, value]) => ({ key: merchant, value }))
    },
    valueFormatter: (number: number) =>
      formatters.currency({ number: number, maxFractionDigits: 0 }),
    layout: "vertical",
    color: "orange",
  },
}

const isInvoiceValid = (
  invoice: Invoice,
  filterDate: Date,
  minAmount: number,
  maxAmount: number
) => {
  const dueDate = new Date(invoice.due_date || invoice.invoice_date)
  return (
    dueDate >= filterDate &&
    invoice.amount >= minAmount &&
    invoice.amount <= maxAmount
  )
}

export function InvoiceChart({
  type,
  yAxisWidth,
  showYAxis,
  className,
  invoices,
  isLoading = false,
}: {
  type: ChartType
  yAxisWidth?: number
  showYAxis?: boolean
  className?: string
  invoices: Invoice[]
  isLoading?: boolean
}) {
  const [range] = useQueryState<RangeKey>("range", {
    defaultValue: DEFAULT_RANGE,
    parse: (value): RangeKey =>
      Object.keys(RANGE_DAYS).includes(value)
        ? (value as RangeKey)
        : DEFAULT_RANGE,
  })
  const [amountRange] = useQueryState("amount_range", {
    defaultValue: "0-Infinity",
  })
  const [expenseStatus] = useQueryState("expense_status", {
    defaultValue: "all",
  })
  const [branch] = useQueryState("branch", {
    defaultValue: "all",
  })

  const [minAmount, maxAmount] = useMemo(() => {
    const [min, max] = amountRange.split("-").map(Number)
    return [min, max === Infinity ? Number.MAX_SAFE_INTEGER : max]
  }, [amountRange])

  const config = chartConfigs[type]

  const chartData = useMemo(() => {
    if (isLoading || !invoices.length) return []

    const currentDate = new Date()
    const filterDate = new Date(currentDate)
    const daysToSubtract = RANGE_DAYS[range] || RANGE_DAYS[DEFAULT_RANGE]
    filterDate.setDate(currentDate.getDate() - daysToSubtract)
    let filteredInvoices = expenseStatus === "all"
      ? invoices
      : invoices.filter(inv => inv.status === expenseStatus)
    if (branch !== "all") {
      filteredInvoices = filteredInvoices.filter(inv => inv.branch === branch)
    }
    return config.processData(filteredInvoices, filterDate, minAmount, maxAmount)
  }, [range, minAmount, maxAmount, config, invoices, expenseStatus, branch, isLoading])

  const totalValue = useMemo(
    () => Math.round(chartData.reduce((sum, item) => sum + item.value, 0)),
    [chartData],
  )

  // Charts are now handled by page-level loading, so we don't show individual skeletons
  return (
    <div className={cx(className, "w-full")}>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <h2
            id={`${type}-chart-title`}
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            {config.title}
          </h2>
          <Tooltip side="bottom" content={config.tooltipContent}>
            <InfoIcon className="size-4 text-gray-600 dark:text-gray-400" />
          </Tooltip>
        </div>
      </div>
      <p
        className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50"
        aria-live="polite"
      >
        {config.valueFormatter(totalValue)}
      </p>
      <BarChartVariant
        data={chartData}
        index="key"
        categories={["value"]}
        showLegend={false}
        colors={[config.color as AvailableChartColorsKeys]}
        yAxisWidth={yAxisWidth}
        valueFormatter={config.valueFormatter}
        xValueFormatter={config.xValueFormatter}
        showYAxis={showYAxis}
        className="mt-6 h-48"
        layout={config.layout}
        barCategoryGap="6%"
        aria-labelledby={`${type}-chart-title`}
        role="figure"
        aria-roledescription="chart"
      />
    </div>
  )
}
