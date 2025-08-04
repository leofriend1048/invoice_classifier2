"use client"

import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/Dialog'
import { Divider } from '@/components/Divider'
import { Input } from '@/components/TextInput'
import { Textarea } from '@/components/Textarea'
import { AlertCircle, Copy, ExternalLink, Key, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
  description: string | null
  usage_count: number
}

export default function ApiSettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    description: '',
    expires_in_days: ''
  })

  useEffect(() => {
    fetchApiKeys()
  }, [])

  async function fetchApiKeys() {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/api-keys')
      const result = await response.json()
      
      if (result.success) {
        setApiKeys(result.data)
      } else {
        toast.error('Failed to load API keys')
      }
    } catch (error) {
      console.error('Error fetching API keys:', error)
      toast.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  async function createApiKey() {
    try {
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newKeyForm.name,
          description: newKeyForm.description || null,
          expires_in_days: newKeyForm.expires_in_days ? parseInt(newKeyForm.expires_in_days) : null
        }),
      })

      const result = await response.json()

      if (result.success) {
        setCreatedKey(result.api_key)
        setNewKeyForm({ name: '', description: '', expires_in_days: '' })
        fetchApiKeys()
        toast.success('API key created successfully')
      } else {
        toast.error(result.error || 'Failed to create API key')
      }
    } catch (error) {
      console.error('Error creating API key:', error)
      toast.error('Failed to create API key')
    }
  }

  async function deleteApiKey(keyId: string) {
    if (!confirm('Are you sure you want to deactivate this API key? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/api-keys?id=${keyId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        fetchApiKeys()
        toast.success('API key deactivated successfully')
      } else {
        toast.error(result.error || 'Failed to deactivate API key')
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      toast.error('Failed to deactivate API key')
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString()
  }

  function isExpired(expiresAt: string | null) {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            API Management
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage API keys for external integrations like Airbyte
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {/* API Documentation Section */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
            Invoice Export API Documentation
          </h3>
          
          {/* Overview */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">Overview</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The Invoice Export API provides programmatic access to your invoice data for integration with external systems like Airbyte, ETL pipelines, and data warehouses.
            </p>
          </div>

          <Divider />

          {/* Base URL */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">Base URL</h4>
            <code className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-sm">
              /api/invoices/export
            </code>
          </div>

          {/* Authentication */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">Authentication</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              All API requests require an API key to be included in the request header:
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded border">
              <code className="text-sm">x-api-key: your_api_key_here</code>
            </div>
          </div>

          {/* Endpoints */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">Endpoints</h4>
            
            {/* Main Export Endpoint */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <Badge variant="success" className="text-xs">GET</Badge>
                  <code className="text-sm font-mono">/api/invoices/export</code>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Retrieve invoice data with support for pagination, filtering, and incremental sync.
                </p>
                
                <h5 className="text-xs font-semibold text-gray-900 dark:text-gray-50 mb-2">Query Parameters</h5>
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <code className="font-semibold">limit</code>
                    <span className="text-gray-600 dark:text-gray-400">integer</span>
                    <span className="text-gray-600 dark:text-gray-400">optional</span>
                    <span className="text-gray-600 dark:text-gray-400">Max records (1-10,000, default: 1000)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <code className="font-semibold">offset</code>
                    <span className="text-gray-600 dark:text-gray-400">integer</span>
                    <span className="text-gray-600 dark:text-gray-400">optional</span>
                    <span className="text-gray-600 dark:text-gray-400">Records to skip (default: 0)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <code className="font-semibold">from_date</code>
                    <span className="text-gray-600 dark:text-gray-400">string</span>
                    <span className="text-gray-600 dark:text-gray-400">optional</span>
                    <span className="text-gray-600 dark:text-gray-400">Start date filter (YYYY-MM-DD)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <code className="font-semibold">to_date</code>
                    <span className="text-gray-600 dark:text-gray-400">string</span>
                    <span className="text-gray-600 dark:text-gray-400">optional</span>
                    <span className="text-gray-600 dark:text-gray-400">End date filter (YYYY-MM-DD)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <code className="font-semibold">updated_since</code>
                    <span className="text-gray-600 dark:text-gray-400">string</span>
                    <span className="text-gray-600 dark:text-gray-400">optional</span>
                    <span className="text-gray-600 dark:text-gray-400">ISO timestamp for incremental sync</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Health Check Endpoint */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <Badge variant="success" className="text-xs">GET</Badge>
                  <code className="text-sm font-mono">/api/invoices/export/health</code>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Check API health and database connectivity. Useful for monitoring and troubleshooting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Example Requests */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
            Example Requests
          </h3>
          
          <div className="space-y-4">
            <div>
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Basic Export</h5>
              <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto">
                <div>curl -H &quot;x-api-key: your_api_key_here&quot; \</div>
                <div className="ml-4">&quot;https://your-domain.com/api/invoices/export&quot;</div>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Paginated Request</h5>
              <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto">
                <div>curl -H &quot;x-api-key: your_api_key_here&quot; \</div>
                <div className="ml-4">&quot;https://your-domain.com/api/invoices/export?limit=100&amp;offset=200&quot;</div>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Date Range Filter</h5>
              <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto">
                <div>curl -H &quot;x-api-key: your_api_key_here&quot; \</div>
                <div className="ml-4">&quot;https://your-domain.com/api/invoices/export?from_date=2024-01-01&amp;to_date=2024-12-31&quot;</div>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Incremental Sync</h5>
              <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto">
                <div>curl -H &quot;x-api-key: your_api_key_here&quot; \</div>
                <div className="ml-4">&quot;https://your-domain.com/api/invoices/export?updated_since=2024-01-01T00:00:00Z&quot;</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Response Format & Error Codes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
              Response Format
            </h3>
            <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto max-h-96">
              <pre>{`{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "vendor_name": "Example Vendor",
      "invoice_date": "2024-01-15T00:00:00.000Z",
      "due_date": "2024-02-15T00:00:00.000Z",
      "amount": 1250.50,
      "status": "approved",
      "gl_account": "6000",
      "category": "Advertising",
      "subcategory": "Media Buying",
      "branch": "US",
      "division": "Ecommerce",
      "payment_method": "ACH",
      "description": "Facebook Ads Campaign",
      "pdf_url": "https://storage.url/invoice.pdf",
      "extracted_text": "Invoice text content...",
      "classification_suggestion": {
        "category": "Advertising",
        "subcategory": "Media Buying",
        "confidence": 0.95
      },
      "confidence": 0.95,
      "updated_at": "2024-01-15T10:30:00.000Z",
      "is_paid": false,
      "exported_at": "2024-01-16T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total_count": 5000,
    "limit": 1000,
    "offset": 0,
    "returned_count": 1000,
    "has_more": true
  },
  "filters_applied": {
    "from_date": null,
    "to_date": null,
    "updated_since": null
  },
  "exported_at": "2024-01-16T12:00:00.000Z"
}`}</pre>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
              Error Codes
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded">
                <div>
                  <code className="font-semibold text-red-600 dark:text-red-400 text-sm">401</code>
                  <span className="block font-semibold text-sm">Unauthorized</span>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Invalid or missing API key</span>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                <div>
                  <code className="font-semibold text-yellow-600 dark:text-yellow-400 text-sm">400</code>
                  <span className="block font-semibold text-sm">Bad Request</span>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Invalid parameters (e.g., limit &gt; 10,000)</span>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                <div>
                  <code className="font-semibold text-sm">429</code>
                  <span className="block font-semibold text-sm">Rate Limited</span>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Too many requests</span>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded">
                <div>
                  <code className="font-semibold text-red-600 dark:text-red-400 text-sm">500</code>
                  <span className="block font-semibold text-sm">Server Error</span>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Internal server error</span>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">Best Practices</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>Use incremental sync with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">updated_since</code></span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>Implement exponential backoff for retries</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>Use reasonable page sizes (100-1000)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>Store API keys securely</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Airbyte Integration Guide */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
            <ExternalLink className="h-5 w-5 mr-2" />
            Airbyte Integration Guide
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Source Configuration</h4>
              <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-200">
                <li><strong>Source Type:</strong> HTTP API / REST API</li>
                <li><strong>Base URL:</strong><br />
                  <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded text-xs break-all">
                    https://your-domain.com/api/invoices/export
                  </code>
                </li>
                <li><strong>Authentication:</strong> API Key Header</li>
                <li><strong>Header Name:</strong> <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">x-api-key</code></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Incremental Sync Setup</h4>
              <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-200">
                <li><strong>Cursor Field:</strong> <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">updated_at</code></li>
                <li><strong>URL Path:</strong><br />
                  <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded text-xs">
                    /?updated_since={'{{ stream_state.updated_at }}'}
                  </code>
                </li>
                <li><strong>Schedule:</strong> Daily at 2 AM UTC</li>
                <li><strong>Sync Mode:</strong> Incremental | Append + Deduped</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>💡 Pro Tip:</strong> Test your connection with the health endpoint first, then start with a small date range before setting up the full sync.
            </p>
          </div>
        </div>
      </Card>

      {/* API Keys List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading API keys...</p>
          </Card>
        ) : apiKeys.length === 0 ? (
          <Card className="p-6 text-center">
            <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-2">
              No API keys yet
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create your first API key to start accessing your invoice data from external systems.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first API key
            </Button>
          </Card>
        ) : (
          apiKeys.map((key) => (
            <Card key={key.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-50">
                      {key.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {key.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="error">Inactive</Badge>
                      )}
                      {isExpired(key.expires_at) && (
                        <Badge variant="error" className="flex items-center space-x-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>Expired</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400">
                      <span><strong>Key:</strong> {key.key_prefix}</span>
                      <span><strong>Created:</strong> {formatDate(key.created_at)}</span>
                      <span><strong>Last used:</strong> {formatDate(key.last_used_at)}</span>
                      <span><strong>Usage:</strong> {key.usage_count} times</span>
                      {key.expires_at && (
                        <span><strong>Expires:</strong> {formatDate(key.expires_at)}</span>
                      )}
                    </div>
                    {key.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {key.description}
                      </p>
                    )}
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Permissions:</span>
                      {key.permissions.map((permission) => (
                        <Badge key={permission} variant="neutral" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    onClick={() => copyToClipboard(key.key_prefix)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => deleteApiKey(key.id)}
                    disabled={!key.is_active}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <Input
                value={newKeyForm.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKeyForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Airbyte Production Key"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Textarea
                value={newKeyForm.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewKeyForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description for this API key"
                rows={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Expires in (days)</label>
              <Input
                type="number"
                value={newKeyForm.expires_in_days}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKeyForm(prev => ({ ...prev, expires_in_days: e.target.value }))}
                placeholder="Leave empty for no expiration"
                min="1"
                max="365"
              />
            </div>
          </div>

          <Divider className="my-4" />

          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createApiKey}
              disabled={!newKeyForm.name.trim()}
            >
              Create API Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show Created Key Dialog */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-600">API Key Created Successfully!</DialogTitle>
          </DialogHeader>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Important: Save this API key now
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  This is the only time you&apos;ll see the full API key. Store it securely.
                </p>
              </div>
            </div>
          </div>

          {createdKey && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <label className="block text-sm font-medium mb-2">Your API Key:</label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 p-2 bg-white dark:bg-gray-800 border rounded text-sm font-mono break-all">
                  {createdKey}
                </code>
                <Button
                  variant="secondary"
                  onClick={() => copyToClipboard(createdKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setCreatedKey(null)}>
              I&apos;ve saved the key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}