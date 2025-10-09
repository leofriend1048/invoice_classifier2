"use client"

import { Button } from "@/components/Button"
import { AlertCircle, CheckCircle, FileText, Upload, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

// DragDropUpload component for PDF file uploads with drag-and-drop functionality

interface UploadedFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  progress?: number
  error?: string
  invoiceId?: string
}

interface DragDropUploadProps {
  onUploadComplete?: (invoices: any[]) => void
  className?: string
}

export default function DragDropUpload({ onUploadComplete, className = "" }: DragDropUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const addFiles = useCallback((newFiles: File[]) => {
    const uploadFiles: UploadedFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending'
    }))

    setFiles(prev => [...prev, ...uploadFiles])
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const pdfFiles = droppedFiles.filter(file => file.type === 'application/pdf')
    
    if (pdfFiles.length !== droppedFiles.length) {
      toast.warning("Only PDF files are supported", {
        description: "Some files were filtered out"
      })
    }

    if (pdfFiles.length > 0) {
      addFiles(pdfFiles)
    }
  }, [addFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf')
    
    if (pdfFiles.length !== selectedFiles.length) {
      toast.warning("Only PDF files are supported", {
        description: "Some files were filtered out"
      })
    }

    if (pdfFiles.length > 0) {
      addFiles(pdfFiles)
    }
  }, [addFiles])

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId))
  }, [])

  const uploadFiles = useCallback(async () => {
    if (files.length === 0) return

    setIsUploading(true)
    const completedInvoices: any[] = []
    const failedUploads: string[] = []

    for (const fileItem of files) {
      if (fileItem.status === 'completed') continue

      try {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'uploading' } : f
        ))

        const formData = new FormData()
        formData.append('file', fileItem.file)

        // Add timeout to prevent hanging requests
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

        const response = await fetch('/api/upload-pdf-direct', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Upload failed with status ${response.status}`)
        }

        const result = await response.json()
        
        // Update status to processing
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'processing',
            invoiceId: result.invoiceId 
          } : f
        ))

        // Wait a moment for processing to complete
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Update status to completed
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'completed',
            invoiceId: result.invoiceId 
          } : f
        ))

        completedInvoices.push(result.invoice)

      } catch (error) {
        console.error('Upload error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'error',
            error: errorMessage
          } : f
        ))
        
        failedUploads.push(`${fileItem.file.name}: ${errorMessage}`)
      }
    }

    setIsUploading(false)
    
    // Show appropriate success/error messages
    if (completedInvoices.length > 0 && failedUploads.length === 0) {
      toast.success(`Successfully uploaded ${completedInvoices.length} PDF(s)`, {
        description: "Invoices are being processed and will appear in your transactions list"
      })
      onUploadComplete?.(completedInvoices)
    } else if (completedInvoices.length > 0 && failedUploads.length > 0) {
      toast.warning(`Uploaded ${completedInvoices.length} PDF(s), but ${failedUploads.length} failed`, {
        description: failedUploads.slice(0, 3).join(', ') + (failedUploads.length > 3 ? '...' : '')
      })
      onUploadComplete?.(completedInvoices)
    } else if (failedUploads.length > 0) {
      toast.error(`All uploads failed`, {
        description: failedUploads.slice(0, 3).join(', ') + (failedUploads.length > 3 ? '...' : '')
      })
    }
  }, [files, onUploadComplete])

  const clearAll = useCallback(() => {
    setFiles([])
  }, [])

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="h-4 w-4 text-gray-400" />
      case 'uploading':
        return <Upload className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'processing':
        return <FileText className="h-4 w-4 text-yellow-500 animate-pulse" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return 'Ready to upload'
      case 'uploading':
        return 'Uploading...'
      case 'processing':
        return 'Processing...'
      case 'completed':
        return 'Completed'
      case 'error':
        return 'Error'
    }
  }

  const pendingFiles = files.filter(f => f.status === 'pending')
  const hasErrors = files.some(f => f.status === 'error')

  return (
    <div className={`w-full ${className}`}>
      {/* Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Drop PDF files here
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Or click to select files
        </p>
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="primary"
        >
          Choose Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Files ({files.length})
            </h4>
            <div className="flex gap-2">
              {pendingFiles.length > 0 && (
                <Button
                  onClick={uploadFiles}
                  disabled={isUploading}
                  variant="primary"
                  isLoading={isUploading}
                  loadingText="Uploading..."
                >
                  {isUploading ? 'Uploading...' : `Upload ${pendingFiles.length}`}
                </Button>
              )}
              <Button
                onClick={clearAll}
                variant="secondary"
              >
                Clear All
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getStatusIcon(file.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {file.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {getStatusText(file.status)}
                      {file.error && ` - ${file.error}`}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => removeFile(file.id)}
                  variant="ghost"
                  className="p-1 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {hasErrors && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">
                Some files failed to upload. Please check the errors and try again.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
