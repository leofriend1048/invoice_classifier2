"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/Table"
import { cx } from "@/lib/utils"
import * as React from "react"
import { createContext } from "react"

import { DataTablePagination } from "./DataTablePagination"
import { Filterbar } from "./Filterbar"

import {
  ColumnDef,
  OnChangeFn,
  Row,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Invoice } from "@/data/schema"

interface DataTableProps {
  columns: ColumnDef<Invoice>[]
  data: Invoice[]
  onRowClick?: (row: Row<Invoice>) => void
  onEditClick?: (row: Row<Invoice>) => void
  rowSelection?: RowSelectionState
  setRowSelection?: OnChangeFn<RowSelectionState>
  onTableReady?: (table: any) => void
}

// Context for selection logic
export const DataTableSelectionContext = createContext<{
  handleCheckboxClick: (rowIndex: number, e: React.MouseEvent) => void
  lastClickedIndex: number | null
} | null>(null)

export function DataTable({ columns, data, onRowClick, onEditClick, rowSelection: externalRowSelection, setRowSelection: externalSetRowSelection, onTableReady }: DataTableProps) {
  const pageSize = 20
  const [internalRowSelection, internalSetRowSelection] = React.useState<RowSelectionState>({})
  const rowSelection = externalRowSelection ?? internalRowSelection
  const setRowSelection = externalSetRowSelection ?? internalSetRowSelection
  const [lastClickedIndex, setLastClickedIndex] = React.useState<number | null>(null)
  const table = useReactTable<Invoice>({
    data,
    columns,
    state: {
      rowSelection,
    },
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: pageSize,
      },
    },
    enableRowSelection: true,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  React.useEffect(() => {
    if (onTableReady) onTableReady(table)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

  function handleCheckboxClick(rowIndex: number, e: React.MouseEvent) {
    if (e.shiftKey && lastClickedIndex !== null) {
      // Select range
      const start = Math.min(lastClickedIndex, rowIndex)
      const end = Math.max(lastClickedIndex, rowIndex)
      const newSelection = { ...rowSelection }
      for (let i = start; i <= end; i++) {
        const rowId = table.getRowModel().rows[i]?.id
        if (rowId) newSelection[rowId] = true
      }
      setRowSelection(newSelection)
    } else {
      setLastClickedIndex(rowIndex)
    }
  }

  return (
    <DataTableSelectionContext.Provider value={{ handleCheckboxClick, lastClickedIndex }}>
      <div className="space-y-3">
        <Filterbar table={table} />
        <div className="relative overflow-hidden overflow-x-auto">
          <Table>
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-y border-gray-200 dark:border-gray-800"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHeaderCell
                      key={header.id}
                      className={cx(
                        "whitespace-nowrap py-1",
                        header.column.columnDef.meta?.className,
                      )}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHeaderCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, rowIndex) => (
                  <TableRow
                    key={row.id}
                    className="group select-none hover:bg-gray-50 hover:dark:bg-gray-900"
                  >
                    {row.getVisibleCells().map((cell, index) => (
                      <TableCell
                        key={cell.id}
                        className={cx(
                          row.getIsSelected()
                            ? "bg-gray-50 dark:bg-gray-900"
                            : "",
                          "relative whitespace-nowrap py-2 text-gray-700 first:w-10 dark:text-gray-300",
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        {index === 0 && row.getIsSelected() && (
                          <div className="absolute inset-y-0 left-0 w-0.5 bg-blue-500 dark:bg-blue-500" />
                        )}
                        {flexRender(
                          cell.column.columnDef.cell,
                          { ...cell.getContext(), rowIndex }
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={table} pageSize={pageSize} />
      </div>
    </DataTableSelectionContext.Provider>
  )
}
