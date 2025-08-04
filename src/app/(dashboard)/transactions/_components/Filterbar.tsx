import { Button } from "@/components/Button"
import { DataTableFilter } from "@/components/DataTableFilter"
import { Searchbar } from "@/components/Searchbar"
import { RiDownloadLine } from "@remixicon/react"
import { Table } from "@tanstack/react-table"
import { useMemo, useState } from "react"

// Placeholder for ViewOptions; replace with your actual component if available
function ViewOptions() {
  return (
    <Button variant="secondary" className="px-2 py-1.5 text-sm">View</Button>
  )
}

export function Filterbar<TData>({ table }: { table: Table<TData> }) {
  const [searchTerm, setSearchTerm] = useState("")

  // Dynamically get unique category options from the table data
  const preFilteredRows = table.getPreFilteredRowModel().rows
  const categoryOptions = useMemo(() => {
    const col = table.getColumn("category")
    if (!col) return []
    const values = preFilteredRows
      .map(row => row.getValue("category"))
      .filter(Boolean) as string[]
    const unique = Array.from(new Set(values))
    return unique.map((cat) => ({ label: cat, value: cat }))
  }, [table, preFilteredRows])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(e.target.value)
    table.getColumn("vendor_name")?.setFilterValue(e.target.value)
  }

  function handleExport() {
    // Basic CSV export for visible rows
    const rows = table.getFilteredRowModel().rows
    if (!rows.length) return
    const headers = table.getVisibleLeafColumns().map(col => col.id)
    const csv = [
      headers.join(","),
      ...rows.map(row => headers.map(h => JSON.stringify(row.getValue(h) ?? "")).join(","))
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "invoices.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Example options; replace with dynamic if needed
  const statusOptions = [
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ]
  const amountConditionOptions = [
    { label: "Greater than", value: "greater-than" },
    { label: "Less than", value: "less-than" },
    { label: "Is between", value: "is-between" },
  ]
  const branchOptions = [
    { label: "Michael Todd Beauty", value: "Michael Todd Beauty" },
    { label: "NasalFresh MD", value: "NasalFresh MD" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-x-6">
      <div className="flex w-full flex-col gap-2 sm:w-fit sm:flex-row sm:items-center">
        {table.getColumn("status")?.getIsVisible() && (
          <DataTableFilter
            column={table.getColumn("status")}
            title="Status"
            options={statusOptions}
            type="select"
          />
        )}
        {table.getColumn("category")?.getIsVisible() && (
          <DataTableFilter
            column={table.getColumn("category")}
            title="Category"
            options={categoryOptions}
            type="select"
          />
        )}
        {table.getColumn("branch")?.getIsVisible() && (
          <DataTableFilter
            column={table.getColumn("branch")}
            title="Branch"
            options={branchOptions}
            type="select"
          />
        )}
        {table.getColumn("amount")?.getIsVisible() && (
          <DataTableFilter
            column={table.getColumn("amount")}
            title="Amount"
            options={amountConditionOptions}
            type="number"
            formatter={v => v ? `$${v}` : ""}
          />
        )}
        <Searchbar
          type="search"
          placeholder="Search invoices..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full sm:max-w-[250px] sm:[&>input]:h-[30px]"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className="gap-x-2 px-2 py-1.5 text-sm"
          onClick={handleExport}
        >
          <RiDownloadLine className="size-4 shrink-0" aria-hidden="true" />
          Export
        </Button>
        <ViewOptions />
      </div>
    </div>
  )
} 