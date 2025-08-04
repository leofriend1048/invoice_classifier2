"use client"
import { DataTableDrawerFeed } from "@/app/(dashboard)/transactions/_components/DataTableDrawerFeed"
import { Badge, BadgeProps } from "@/components/Badge"
import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select"
import { Switch } from "@/components/Switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/Tabs"
import { categories, Invoice, invoice_statuses, subcategories } from "@/data/schema"
import { formatters } from "@/lib/utils"
import { createClient } from "@supabase/supabase-js"
import { format } from "date-fns"
import React, { useEffect, useState } from "react"
import { toast } from "sonner"

interface DataTableDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  datas: Invoice | undefined
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function DataTableDrawer({
  open,
  onOpenChange,
  datas,
}: DataTableDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState("")
  const [subcategory, setSubcategory] = useState("")
  const [description, setDescription] = useState("")
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [subcategoryOptions, setSubcategoryOptions] = useState<string[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [vendorName, setVendorName] = useState("")
  const [invoiceDate, setInvoiceDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [amount, setAmount] = useState("")
  const [glAccount, setGlAccount] = useState("")
  const [branch, setBranch] = useState("")
  const [division, setDivision] = useState("Ecommerce")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [isPaid, setIsPaid] = useState(false)
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentPdfUrl, setCurrentPdfUrl] = useState("")

  const glAccountOptions = [
    { value: "618000-00", label: "618000-00 Software Subscription Fees" },
    { value: "606250-40", label: "606250-40 Web Advertising Services" },
    { value: "687500-00", label: "687500-00 Graphic and Creative: Talent Expense" },
    { value: "6880000-00", label: "6880000-00 Graphic and Creative: Other" },
    { value: "688000-00", label: "688000-00 Graphic and Creative – Content" },
    { value: "604000-40", label: "604000-40 Product Sampling" },
    { value: "689500-00", label: "689500-00 Web Services" },
    { value: "601600-40", label: "601600-40 Direct Mailers" },
    { value: "601500-40", label: "601500-40 Email MTB" },
    { value: "603800-40", label: "603800-40 MTB Google Ads" },
    { value: "603805-00", label: "603805-00 NFMD Google Ads" },
  ];
  const branchOptions = [
    "Michael Todd Beauty", "NasalFresh MD"
  ];
  const divisionOptions = [
    "Ecommerce", "Corporate"
  ];
  const paymentMethodOptions = [
    "ACH", "Credit Card", "Wire", "Paypal", "Check"
  ];

  // Sync state with datas when opening
  useEffect(() => {
    if (datas) {
      // Parse classification_suggestion if present and not already an object
      let suggestion: any = {};
      if (datas.classification_suggestion) {
        if (typeof datas.classification_suggestion === 'string') {
          try {
            suggestion = JSON.parse(datas.classification_suggestion);
          } catch {
            suggestion = {};
          }
        } else {
          suggestion = datas.classification_suggestion;
        }
      }
      setCategory(datas.category || suggestion.category || "")
      setSubcategory(datas.subcategory || suggestion.subcategory || "")
      setDescription(datas.description || suggestion.description || "")
      setVendorName(datas.vendor_name || "")
      setInvoiceDate(datas.invoice_date || "")
      setDueDate(datas.due_date || "")
      setAmount(datas.amount ? String(datas.amount) : "")
      setGlAccount(datas.gl_account || suggestion.gl_account || "")
      setBranch(datas.branch || suggestion.branch || "")
      setDivision(datas.division || suggestion.division || "Ecommerce")
      setPaymentMethod(datas.payment_method || suggestion.payment_method || "")
      setIsPaid(!!datas.is_paid)
      setCurrentPdfUrl(datas.pdf_url || "")
    }
  }, [datas, open])

  // Fetch unique categories and subcategories from Supabase
  useEffect(() => {
    if (!open) return;
    setOptionsLoading(true)
    async function fetchOptions() {
      const { data, error } = await supabase
        .from("invoice_class_invoices")
        .select("category, subcategory")
      if (!error && data) {
        // Always include static categories
        const cats = Array.from(new Set([
          ...categories,
          ...data.map((row: any) => row.category).filter(Boolean)
        ]))
        setCategoryOptions(cats)
        // For subcategories:
        let subs: string[] = []
        if (category) {
          // All static subcategories for the selected category
          const staticSubs = subcategories[category] || []
          // All custom subcategories for this category from DB
          const dbSubs = data
            .filter((row: any) => row.category === category)
            .map((row: any) => row.subcategory)
            .filter(Boolean)
          subs = Array.from(new Set([
            ...staticSubs,
            ...dbSubs
          ]))
        } else {
          // All static subcategories from all categories
          const allStaticSubs = Object.values(subcategories).flat()
          // All custom subcategories from DB
          const dbSubs = data.map((row: any) => row.subcategory).filter(Boolean)
          subs = Array.from(new Set([
            ...allStaticSubs,
            ...dbSubs
          ]))
        }
        setSubcategoryOptions(subs)
      }
      setOptionsLoading(false)
    }
    fetchOptions()
  }, [open, category])

  const status = invoice_statuses.find(
    (item) => item.value === datas?.status,
  )

  async function handleSave() {
    if (!datas) return
    setLoading(true)

    try {
      const oldVals = {
        category: datas.category,
        subcategory: datas.subcategory,
        description: datas.description,
        vendor_name: datas.vendor_name,
        invoice_date: datas.invoice_date,
        due_date: datas.due_date,
        amount: datas.amount,
        gl_account: datas.gl_account,
        branch: datas.branch,
        division: datas.division,
        payment_method: datas.payment_method,
      }

      // Prepare the update object with proper validation
      const newVals: any = {}

      // Helper function to safely trim and validate strings
      const safeString = (value: string | undefined | null) => {
        if (!value) return null
        const trimmed = value.trim()
        return trimmed === "" ? null : trimmed
      }

      // Required fields - only update if we have valid values
      if (vendorName && safeString(vendorName)) {
        newVals.vendor_name = safeString(vendorName)
      }

      if (glAccount && safeString(glAccount)) {
        newVals.gl_account = safeString(glAccount)
      }

      if (branch && safeString(branch)) {
        newVals.branch = safeString(branch)
      }

      if (paymentMethod && safeString(paymentMethod)) {
        newVals.payment_method = safeString(paymentMethod)
      }

      // Division is required but has a default
      if (division && safeString(division)) {
        newVals.division = safeString(division)
      }

      // Optional fields
      if (category !== undefined && safeString(category)) {
        newVals.category = safeString(category)
      }

      if (subcategory !== undefined && safeString(subcategory)) {
        newVals.subcategory = safeString(subcategory)
      }

      if (description !== undefined) {
        newVals.description = safeString(description)
      }

      if (invoiceDate && invoiceDate.trim() !== "") {
        // Convert YYYY-MM-DD to ISO string format
        const date = new Date(invoiceDate.trim())
        if (!isNaN(date.getTime())) {
          newVals.invoice_date = date.toISOString().split('T')[0] // Keep just the date part
        }
      }

      if (dueDate && dueDate.trim() !== "") {
        // Convert YYYY-MM-DD to ISO string format
        const date = new Date(dueDate.trim())
        if (!isNaN(date.getTime())) {
          newVals.due_date = date.toISOString().split('T')[0] // Keep just the date part
        }
      }

      if (amount !== undefined && amount !== "") {
        const parsedAmount = parseFloat(amount)
        if (!isNaN(parsedAmount)) {
          newVals.amount = parsedAmount
        }
      }

      console.log("Updating invoice with data:", newVals)

      // Check if we have any fields to update
      if (Object.keys(newVals).length === 0) {
        console.log("No fields to update, closing drawer")
        setLoading(false)
        onOpenChange(false)
        return
      }

      // Update the invoice
      const { error: updateError } = await supabase
        .from("invoice_class_invoices")
        .update(newVals)
        .eq("id", datas.id)

      if (updateError) {
        console.error("Failed to update invoice:", updateError)
        console.error("Update data that caused error:", newVals)
        console.error("Full Supabase error:", updateError)
        alert(`Failed to update invoice: ${updateError.message}\n\nPlease check the console for more details.`)
        setLoading(false)
        return
      }

      // Add audit trail entry
      const { error: auditError } = await supabase
        .from("invoice_class_invoice_audit_trail")
        .insert({
          invoice_id: datas.id,
          action: "field_edited",
          performed_by: "ui_user", // Replace with real user if available
          details: {
            before: oldVals,
            after: newVals,
          },
        })

      if (auditError) {
        console.error("Failed to create audit trail:", auditError)
        // Don't fail the save operation if audit trail fails
      }

      setLoading(false)
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving invoice:", error)
      alert("An error occurred while saving the invoice. Please try again.")
      setLoading(false)
    }
  }

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !datas?.id) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file.')
      return
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB.')
      return
    }

    setIsUploadingPdf(true)
    setUploadProgress(0)

    let progressInterval: NodeJS.Timeout | null = null

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('invoiceId', datas.id)

      // Simulate progress for better UX
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            return prev
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      // Clear interval and set progress to 100%
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
      setUploadProgress(100)

      // Update both local state and optimistically update the datas object
      const newPdfUrl = result.data.pdf_url
      setCurrentPdfUrl(newPdfUrl)
      
      // Optimistically update the parent data to prevent state loss on drawer reopen
      if (datas) {
        datas.pdf_url = newPdfUrl
      }

      // Show success message
      toast.success('PDF uploaded successfully!')

      // Reset the file input
      event.target.value = ''

    } catch (error) {
      console.error('PDF upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload PDF')
    } finally {
      // Ensure interval is always cleared
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      setIsUploadingPdf(false)
      setUploadProgress(0)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {datas ? (
        <DrawerContent className="overflow-x-hidden sm:max-w-lg dark:bg-gray-925">
          <DrawerHeader className="-px-6 w-full">
            <DrawerTitle className="flex w-full items-center justify-between">
              <span>{datas.vendor_name}</span>
              <span>{formatters.currency({ number: datas.amount })}</span>
            </DrawerTitle>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-left text-sm text-gray-500 dark:text-gray-500">
                {datas.invoice_date ? format(new Date(datas.invoice_date), "MMM dd, yyyy") : "-"}
              </span>
              <Badge variant={status?.variant as BadgeProps["variant"]}>
                {status?.label}
              </Badge>
            </div>
            {typeof datas.confidence === "number" && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Confidence:</span>
                <Badge variant={datas.confidence >= 0.8 ? "success" : datas.confidence >= 0.5 ? "warning" : "error"}>
                  {(datas.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
            )}
          </DrawerHeader>
          <DrawerBody className="-mx-6 overflow-y-scroll">
            <Tabs defaultValue="details">
              <TabsList className="px-6">
                <TabsTrigger value="details" className="px-4">
                  Details
                </TabsTrigger>
                <TabsTrigger value="accounting" className="px-4">
                  Accounting
                </TabsTrigger>
                <TabsTrigger value="extracted" className="px-4">
                  Extracted Text
                </TabsTrigger>
                <TabsTrigger value="pdf" className="px-4">
                  PDF
                </TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-6 px-6">
                <form className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-medium">Vendor</Label>
                    <div className="mt-1 text-sm text-gray-900 dark:text-gray-50">{datas.vendor_name}</div>
                  </div>
                  <div>
                    <Label className="font-medium">Invoice Date</Label>
                    <div className="mt-1 text-sm text-gray-900 dark:text-gray-50">{datas.invoice_date ? format(new Date(datas.invoice_date), "MMM dd, yyyy") : "-"}</div>
                  </div>
                  <div>
                    <Label className="font-medium">Due Date</Label>
                    <div className="mt-1 text-sm text-gray-900 dark:text-gray-50">{datas.due_date ? format(new Date(datas.due_date), "MMM dd, yyyy") : "-"}</div>
                  </div>
                  <div>
                    <Label className="font-medium">Amount</Label>
                    <div className="mt-1 text-sm text-gray-900 dark:text-gray-50">{formatters.currency({ number: datas.amount })}</div>
                  </div>
                  <div>
                    <Label className="font-medium">GL Account</Label>
                    <Select value={glAccount} onValueChange={setGlAccount}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select GL Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {glAccountOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-medium">Branch</Label>
                    <Select value={branch} onValueChange={setBranch}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-medium">Division</Label>
                    <Select value={division} onValueChange={setDivision}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select Division" />
                      </SelectTrigger>
                      <SelectContent>
                        {divisionOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-medium">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select Payment Method" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethodOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="font-medium">Category</Label>
                    <CustomSelect
                      value={category}
                      onValueChange={setCategory}
                      options={categoryOptions}
                      loading={optionsLoading}
                      placeholder="Select or type to add..."
                      label="Category"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="font-medium">Subcategory</Label>
                    <CustomSelect
                      value={subcategory}
                      onValueChange={setSubcategory}
                      options={subcategoryOptions}
                      loading={optionsLoading}
                      placeholder="Select or type to add..."
                      label="Subcategory"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="font-medium">Description</Label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} className="mt-2" />
                  </div>
                  <div className="col-span-2">
                    <Label className="font-medium">Vendor Name</Label>
                    <Input value={vendorName} onChange={e => setVendorName(e.target.value)} className="mt-2" />
                  </div>
                  <div className="col-span-2">
                    <Label className="font-medium">Invoice Date</Label>
                    <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="mt-2" />
                  </div>
                  <div className="col-span-2">
                    <Label className="font-medium">Due Date</Label>
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-2" />
                  </div>
                  <div className="col-span-2">
                    <Label className="font-medium">Amount</Label>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-2" />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-3 mt-2">
                      <Label className="font-medium mb-0">Paid?</Label>
                      <Switch
                        checked={isPaid}
                        onCheckedChange={async (checked) => {
                          setIsPaid(checked);
                          if (!datas) return;
                          setLoading(true);
                          await supabase
                            .from("invoice_class_invoices")
                            .update({ is_paid: checked })
                            .eq("id", datas.id);
                          await supabase
                            .from("invoice_class_invoice_audit_trail")
                            .insert({
                              invoice_id: datas.id,
                              action: "is_paid_updated",
                              performed_by: "ui_user",
                              details: {
                                before: { is_paid: datas.is_paid },
                                after: { is_paid: checked },
                              },
                            });
                          setLoading(false);
                        }}
                        size="default"
                      />
                    </div>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="accounting" className="space-y-6 px-6">
                <h3 className="mt-6 text-sm font-medium text-gray-900 dark:text-gray-50">
                  Audit trail
                </h3>
                {datas?.id && <DataTableDrawerFeed invoiceId={datas.id} />}
              </TabsContent>
              <TabsContent value="extracted" className="space-y-6 px-6">
                <div className="mt-6">
                  <Label className="font-medium">Extracted Text</Label>
                  <div className="mt-2 whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                    {datas.extracted_text || "No extracted text available."}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="pdf" className="space-y-6 px-6">
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="font-medium">PDF Document</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfUpload}
                        disabled={isUploadingPdf}
                        className="hidden"
                        id="pdf-upload"
                      />
                      <label
                        htmlFor="pdf-upload"
                        className={`cursor-pointer inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 ${isUploadingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isUploadingPdf ? 'Uploading...' : (datas.pdf_url || currentPdfUrl) ? 'Replace PDF' : 'Upload PDF'}
                      </label>
                    </div>
                  </div>
                  
                  {isUploadingPdf && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span>Uploading PDF...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {(datas.pdf_url || currentPdfUrl) ? (
                    <iframe
                      src={currentPdfUrl || datas.pdf_url}
                      title="Invoice PDF"
                      className="w-full h-96 rounded border border-gray-200 dark:border-gray-800"
                      key={currentPdfUrl || datas.pdf_url} // Force reload when URL changes
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-96 border border-dashed border-gray-300 rounded-lg bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
                      <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No PDF document</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload a PDF file to view it here.</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </DrawerBody>
          <DrawerFooter className="-mx-6 -mb-2 gap-2 bg-white px-6 dark:bg-gray-925">
            <Button variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" className="w-full" isLoading={loading} onClick={handleSave}>
              Save
            </Button>
          </DrawerFooter>
        </DrawerContent>
      ) : null}
    </Drawer>
  )
}

function CustomSelect({ value, onValueChange, options, loading, placeholder, label }: {
  value: string
  onValueChange: (val: string) => void
  options: string[]
  loading?: boolean
  placeholder?: string
  label?: string
}) {
  const [input, setInput] = useState("")
  const [open, setOpen] = useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const filtered = options.filter(opt => opt.toLowerCase().includes(input.toLowerCase()) || opt === value)

  function handleSelect(val: string) {
    onValueChange(val)
    setInput("")
    setOpen(false)
  }
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value)
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim()) {
      onValueChange(input.trim())
      setInput("")
      setOpen(false)
      e.preventDefault()
    }
    if (e.key === "Escape") {
      setOpen(false)
    }
  }
  function handleTriggerClick() {
    setOpen((prev) => !prev)
    setTimeout(() => inputRef.current?.focus(), 100)
  }
  return (
    <div className="relative mt-2">
      <div
        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus-within:border-blue-500 focus-within:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 cursor-pointer flex items-center justify-between"
        tabIndex={0}
        onClick={handleTriggerClick}
        onKeyDown={e => { if (e.key === "Enter" || e.key === "ArrowDown") { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100) } }}
        aria-label={label}
      >
        <span className={value ? "" : "text-gray-400"}>{value || placeholder}</span>
        <svg className="ml-2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <input
              ref={inputRef}
              className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={"Type to add new..."}
              autoFocus
            />
          </div>
          {loading ? (
            <div className="p-2 text-sm text-gray-500">Loading...</div>
          ) : (
            filtered.length > 0 ? filtered.map(opt => (
              <div
                key={opt}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${opt === value ? "bg-blue-50 dark:bg-blue-900" : ""}`}
                onMouseDown={() => handleSelect(opt)}
              >
                {opt}
              </div>
            )) : (
              <div className="p-2 text-sm text-gray-500">No options</div>
            )
          )}
        </div>
      )}
    </div>
  )
}
