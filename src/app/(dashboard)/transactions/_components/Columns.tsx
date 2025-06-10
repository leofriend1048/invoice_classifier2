"use client"

import { Badge, BadgeProps } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Checkbox } from "@/components/Checkbox"
import { Switch } from "@/components/Switch"
import { Invoice, invoice_statuses } from "@/data/schema"
import { formatters } from "@/lib/utils"
import { ColumnDef, createColumnHelper, Row } from "@tanstack/react-table"
import { format } from "date-fns"
import { Ellipsis } from "lucide-react"
import React, { useContext } from "react"
import { DataTableSelectionContext } from "./DataTable"
import { DataTableColumnHeader } from "./DataTableColumnHeader"

const columnHelper = createColumnHelper<Invoice>()

function DataTableSelectCell({ row, rowIndex }: { row: any; rowIndex: number }) {
  const selectionCtx = useContext(DataTableSelectionContext)
  return (
    <Checkbox
      checked={row.getIsSelected()}
      onClick={e => {
        e.stopPropagation()
        if (selectionCtx) selectionCtx.handleCheckboxClick(rowIndex, e)
      }}
      onCheckedChange={() => row.toggleSelected()}
      className="translate-y-0.5"
      aria-label="Select row"
    />
  )
}

function PaidSwitchCell({ invoice }: { invoice: any }) {
  const [loading, setLoading] = React.useState(false);
  const [isPaid, setIsPaid] = React.useState(!!invoice.is_paid);
  React.useEffect(() => {
    setIsPaid(!!invoice.is_paid);
  }, [invoice.is_paid]);
  return (
    <Switch
      checked={isPaid}
      onCheckedChange={async (checked) => {
        setIsPaid(checked);
        setLoading(true);
        await fetch("/api/invoice-paid-toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: invoice.id, is_paid: checked }),
        });
        setLoading(false);
      }}
      size="small"
      disabled={loading}
    />
  );
}

export const getColumns = ({
  onEditClick,
}: {
  onEditClick: (row: Row<Invoice>) => void
}) =>
  [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomeRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={() => table.toggleAllPageRowsSelected()}
          className="translate-y-0.5"
          aria-label="Select all"
        />
      ),
      cell: (ctx) => {
        // rowIndex is available from DataTable via cell context
        // @ts-expect-error rowIndex is injected in DataTable
        const rowIndex = ctx.rowIndex as number
        return <DataTableSelectCell row={ctx.row} rowIndex={rowIndex} />
      },
      enableSorting: false,
      enableHiding: false,
      meta: {
        displayName: "Select",
      },
    }),
    columnHelper.accessor("vendor_name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vendor" />
      ),
      enableSorting: false,
      meta: {
        className: "text-left",
        displayName: "Vendor",
      },
    }),
    columnHelper.accessor("invoice_date", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice Date" />
      ),
      cell: ({ getValue }) => {
        const date = getValue()
        return format(new Date(date), "MMM dd, yyyy")
      },
      enableSorting: true,
      enableHiding: false,
      meta: {
        className: "tabular-nums",
        displayName: "Invoice Date",
      },
    }),
    columnHelper.accessor("due_date", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due Date" />
      ),
      cell: ({ getValue }) => {
        const date = getValue()
        return date ? format(new Date(date), "MMM dd, yyyy") : "-"
      },
      enableSorting: true,
      enableHiding: false,
      meta: {
        className: "tabular-nums",
        displayName: "Due Date",
      },
    }),
    columnHelper.accessor("amount", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      enableSorting: true,
      meta: {
        className: "text-right",
        displayName: "Amount",
      },
      cell: ({ getValue }) => {
        return (
          <span className="font-medium">
            {formatters.currency({ number: getValue() })}
          </span>
        )
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || typeof filterValue !== 'object' || !('condition' in filterValue)) return true;
        const amountRaw = row.getValue(columnId);
        const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw));
        const { condition, value } = filterValue;
        const num0 = parseFloat(value[0]);
        const num1 = parseFloat(value[1]);
        if (condition === 'greater-than') {
          return amount > num0;
        } else if (condition === 'less-than') {
          return amount < num0;
        } else if (condition === 'is-between') {
          return amount >= num0 && amount <= num1;
        }
        return true;
      },
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      enableSorting: true,
      meta: {
        className: "text-left",
        displayName: "Status",
      },
      cell: ({ row }) => {
        const statusValue = row.getValue("status")
        const status = invoice_statuses.find(
          (item) => item.value === statusValue,
        )
        if (!status) {
          return statusValue // Fallback to displaying the raw status
        }
        return (
          <Badge variant={status.variant as BadgeProps["variant"]}>
            {status.label}
          </Badge>
        )
      },
    }),
    columnHelper.accessor("is_paid", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Paid" />
      ),
      enableSorting: true,
      meta: {
        className: "text-left",
        displayName: "Paid",
      },
      cell: ({ row }) => <PaidSwitchCell invoice={row.original} />,
    }),
    columnHelper.accessor("gl_account", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="GL Account" />
      ),
      enableSorting: false,
      meta: {
        className: "text-left",
        displayName: "GL Account",
      },
      cell: ({ getValue }) => getValue() || "-",
    }),
    columnHelper.accessor("branch", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Branch" />
      ),
      enableSorting: false,
      meta: {
        className: "text-left",
        displayName: "Branch",
      },
      cell: ({ getValue }) => getValue() || "-",
    }),
    columnHelper.accessor("division", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Division" />
      ),
      enableSorting: false,
      meta: {
        className: "text-left",
        displayName: "Division",
      },
      cell: ({ getValue }) => getValue() || "-",
    }),
    columnHelper.accessor("payment_method", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Payment Method" />
      ),
      enableSorting: false,
      meta: {
        className: "text-left",
        displayName: "Payment Method",
      },
      cell: ({ getValue }) => getValue() || "-",
    }),
    columnHelper.accessor("category", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      enableSorting: false,
      meta: {
        className: "text-left",
        displayName: "Category",
      },
      cell: ({ row }) => {
        const value = row.getValue("category")
        let suggestion = undefined;
        const cs: any = row.original.classification_suggestion;
        if (cs) {
          if (typeof cs === 'string') {
            try {
              suggestion = JSON.parse(cs).category;
            } catch {}
          } else {
            suggestion = cs.category;
          }
        }
        return value || suggestion || "-"
      },
    }),
    columnHelper.accessor("subcategory", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subcategory" />
      ),
      enableSorting: false,
      meta: {
        className: "text-left",
        displayName: "Subcategory",
      },
      cell: ({ row }) => {
        const value = row.getValue("subcategory")
        let suggestion = undefined;
        const cs: any = row.original.classification_suggestion;
        if (cs) {
          if (typeof cs === 'string') {
            try {
              suggestion = JSON.parse(cs).subcategory;
            } catch {}
          } else {
            suggestion = cs.subcategory;
          }
        }
        return value || suggestion || "-"
      },
    }),
    columnHelper.accessor("description", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      enableSorting: false,
      meta: {
        className: "text-left",
        displayName: "Description",
      },
      cell: ({ getValue }) => {
        const desc = getValue() || "-";
        const maxLen = 40;
        if (typeof desc === "string" && desc.length > maxLen) {
          return desc.slice(0, maxLen) + "...";
        }
        return desc;
      },
    }),
    columnHelper.display({
      id: "edit",
      header: "Actions",
      enableSorting: false,
      enableHiding: false,
      meta: {
        className: "text-right",
        displayName: "Actions",
      },
      cell: ({ row }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => onEditClick?.(row)}
            className="group aspect-square p-1.5 hover:border hover:border-gray-300 data-[state=open]:border-gray-300 data-[state=open]:bg-gray-50 hover:dark:border-gray-700 data-[state=open]:dark:border-gray-700 data-[state=open]:dark:bg-gray-900"
          >
            <Ellipsis
              className="size-4 shrink-0 text-gray-500 group-hover:text-gray-700 group-data-[state=open]:text-gray-700 group-hover:dark:text-gray-300 group-data-[state=open]:dark:text-gray-300"
              aria-hidden="true"
            />
          </Button>
        )
      },
    }),
  ] as ColumnDef<Invoice>[]
