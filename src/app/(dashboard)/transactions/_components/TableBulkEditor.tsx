"use client"

import { Button } from "@/components/Button"
import {
    CommandBar,
    CommandBarBar,
    CommandBarCommand,
    CommandBarSeperator,
    CommandBarValue,
} from "@/components/CommandBar"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/Dialog"
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/Drawer"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select"
import { categories, Invoice, invoice_statuses } from "@/data/schema"
import { createClient } from "@supabase/supabase-js"
import { RowSelectionState, Table } from "@tanstack/react-table"

import React, { useState } from "react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function DataTableBulkEditor({
  table,
  rowSelection,
}: {
  table: Table<Invoice>
  rowSelection: RowSelectionState
}) {
  const hasSelectedRows = Object.keys(rowSelection).length > 0
  const [loading, setLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const selectedRows = table.getSelectedRowModel().rows.map(row => row.original)
  const selectedIds = selectedRows.map(row => row.id)

  // Bulk edit state
  const [editValues, setEditValues] = useState({
    category: "",
    subcategory: "",
    description: "",
    status: "",
    amount: "",
    due_date: "",
  })

  function openBulkEditDrawer() {
    // If all selected have the same value, prefill, else blank
    const first = selectedRows[0]
    setEditValues({
      category: allSame(selectedRows, "category") ? first.category || "" : "",
      subcategory: allSame(selectedRows, "subcategory") ? first.subcategory || "" : "",
      description: allSame(selectedRows, "description") ? first.description || "" : "",
      status: allSame(selectedRows, "status") ? first.status || "" : "",
      amount: allSame(selectedRows, "amount") ? String(first.amount) : "",
      due_date: allSame(selectedRows, "due_date") ? (first.due_date || "") : "",
    })
    setShowEditDrawer(true)
    // Optionally: set focus to a field if focusField is provided
  }

  function allSame(arr: any[], key: string) {
    return arr.every(item => item[key] === arr[0][key])
  }

  async function handleBulkEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const update: any = {}
    if (editValues.category) update.category = editValues.category
    if (editValues.subcategory) update.subcategory = editValues.subcategory
    if (editValues.description) update.description = editValues.description
    if (editValues.status) update.status = editValues.status
    if (editValues.amount) update.amount = Number(editValues.amount)
    if (editValues.due_date) update.due_date = editValues.due_date
    if (Object.keys(update).length > 0 && selectedIds.length > 0) {
      await supabase.from("invoice_class_invoices").update(update).in("id", selectedIds)
    }
    setLoading(false)
    setShowEditDrawer(false)
    table.resetRowSelection()
  }

  async function handleBulkStatusChange(status: string) {
    setLoading(true)
    if (selectedIds.length > 0) {
      await supabase.from("invoice_class_invoices").update({ status }).in("id", selectedIds)
      // If status is approved, send each invoice to Zapier
      if (status === "approved") {
        for (const invoice of selectedRows) {
          try {
            await fetch("/api/send-to-zapier", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                vendor_name: invoice.vendor_name,
                amount: invoice.amount,
                invoice_date: invoice.invoice_date,
                due_date: invoice.due_date || null,
                payment_method: invoice.payment_method || "",
                branch: invoice.branch || "",
                gl_account: invoice.gl_account || "",
                category: invoice.category || "",
                subcategory: invoice.subcategory || "",
                description: invoice.description || "",
                pdf_url: invoice.pdf_url || "",
                is_paid: invoice.is_paid || false,
              })
            })
            console.log("✅ Sent invoice to Zapier for payment processing.")
          } catch (err) {
            console.error("❌ Failed to send invoice to Zapier:", err)
          }
        }
      }
    }
    setLoading(false)
    table.resetRowSelection()
  }

  async function handleBulkDelete() {
    setLoading(true)
    if (selectedIds.length > 0) {
      await supabase.from("invoice_class_invoices").delete().in("id", selectedIds)
    }
    setLoading(false)
    setShowDeleteDialog(false)
    table.resetRowSelection()
  }

  async function handleBulkExport() {
    if (selectedRows.length === 0) return
    const csv = [
      Object.keys(selectedRows[0]).join(","),
      ...selectedRows.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "invoices.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleBulkMarkAsPaid() {
    setLoading(true);
    if (selectedIds.length > 0) {
      await supabase.from("invoice_class_invoices").update({ is_paid: true }).in("id", selectedIds);
      for (const invoice of selectedRows) {
        await supabase.from("invoice_class_invoice_audit_trail").insert({
          invoice_id: invoice.id,
          action: "is_paid_updated",
          performed_by: "ui_user",
          details: {
            before: { is_paid: invoice.is_paid },
            after: { is_paid: true },
          },
        });
      }
    }
    setLoading(false);
    table.resetRowSelection();
  }

  return (
    <>
      <div className="fixed left-0 right-0 bottom-4 z-40 flex justify-center pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto">
          <CommandBar open={hasSelectedRows}>
            <CommandBarBar>
              <CommandBarValue>
                {selectedIds.length} selected
              </CommandBarValue>
              <CommandBarSeperator />
              <CommandBarCommand
                label="Edit"
                action={() => openBulkEditDrawer()}
                shortcut={{ shortcut: "e" }}
                disabled={loading}
              />
              <CommandBarSeperator />
              <CommandBarCommand
                label="Delete"
                action={() => setShowDeleteDialog(true)}
                shortcut={{ shortcut: "d" }}
                disabled={loading}
              />
              <CommandBarSeperator />
              <CommandBarCommand
                label="Reset"
                action={() => table.resetRowSelection()}
                shortcut={{ shortcut: "Escape", label: "esc" }}
              />
              <CommandBarSeperator />
              <CommandBarCommand
                label="Approve"
                action={() => handleBulkStatusChange("approved")}
                shortcut={{ shortcut: "a" }}
                disabled={loading}
              />
              <CommandBarSeperator />
              <CommandBarCommand
                label="Mark as Pending"
                action={() => handleBulkStatusChange("pending")}
                shortcut={{ shortcut: "g" }}
                disabled={loading}
              />
              <CommandBarSeperator />
              <CommandBarCommand
                label="Mark as Paid"
                action={handleBulkMarkAsPaid}
                shortcut={{ shortcut: "p" }}
                disabled={loading}
              />
              <CommandBarSeperator />
              <CommandBarCommand
                label="Export"
                action={handleBulkExport}
                shortcut={{ shortcut: "x" }}
                disabled={loading}
              />
            </CommandBarBar>
          </CommandBar>
        </div>
      </div>

      {/* Bulk Edit Drawer */}
      <Drawer open={showEditDrawer} onOpenChange={setShowEditDrawer}>
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Edit Selected Invoices</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <form onSubmit={handleBulkEditSubmit} className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={editValues.category}
                  onValueChange={val => setEditValues(v => ({ ...v, category: val }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category, idx) => (
                      <SelectItem key={idx} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subcategory</Label>
                <Input
                  value={editValues.subcategory}
                  onChange={e => setEditValues(v => ({ ...v, subcategory: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={editValues.description}
                  onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editValues.status}
                  onValueChange={val => setEditValues(v => ({ ...v, status: val }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoice_statuses.map((status, idx) => (
                      <SelectItem key={idx} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={editValues.amount}
                  onChange={e => setEditValues(v => ({ ...v, amount: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={editValues.due_date}
                  onChange={e => setEditValues(v => ({ ...v, due_date: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <DrawerFooter>
                <Button type="button" variant="secondary" className="w-full" onClick={() => setShowEditDrawer(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
                  Save Changes
                </Button>
              </DrawerFooter>
            </form>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.length} selected invoice(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" isLoading={loading} onClick={handleBulkDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { DataTableBulkEditor }
