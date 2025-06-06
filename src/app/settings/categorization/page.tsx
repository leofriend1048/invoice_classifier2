"use client"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Divider } from "@/components/Divider"
import { Input } from "@/components/TextInput"
import { createClient } from "@supabase/supabase-js"
import { List, ListItem, Text, Title } from "@tremor/react"
import { useEffect, useState } from "react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function CategorizationSettings() {
  const [categories, setCategories] = useState<string[]>([])
  const [subcategories, setSubcategories] = useState<string[]>([])
  const [catInput, setCatInput] = useState("")
  const [subInput, setSubInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editingCatValue, setEditingCatValue] = useState("")
  const [editingSub, setEditingSub] = useState<string | null>(null)
  const [editingSubValue, setEditingSubValue] = useState("")

  async function fetchOptions() {
    setLoading(true)
    const { data, error } = await supabase
      .from("invoice_class_invoices")
      .select("category, subcategory")
    if (!error && data) {
      setCategories(Array.from(new Set(data.map((row: any) => row.category).filter(Boolean))))
      setSubcategories(Array.from(new Set(data.map((row: any) => row.subcategory).filter(Boolean))))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchOptions()
  }, [])

  async function addCategory() {
    if (!catInput.trim()) return
    await supabase.from("invoice_class_invoices").insert({ category: catInput.trim() })
    setCatInput("")
    fetchOptions()
  }

  async function addSubcategory() {
    if (!subInput.trim()) return
    await supabase.from("invoice_class_invoices").insert({ subcategory: subInput.trim() })
    setSubInput("")
    fetchOptions()
  }

  async function saveEditCategory(oldCat: string, newCat: string) {
    if (!newCat.trim() || oldCat === newCat) {
      setEditingCat(null)
      return
    }
    setLoading(true)
    await supabase
      .from("invoice_class_invoices")
      .update({ category: newCat.trim() })
      .eq("category", oldCat)
    setEditingCat(null)
    setEditingCatValue("")
    fetchOptions()
    setLoading(false)
  }

  async function saveEditSubcategory(oldSub: string, newSub: string) {
    if (!newSub.trim() || oldSub === newSub) {
      setEditingSub(null)
      return
    }
    setLoading(true)
    await supabase
      .from("invoice_class_invoices")
      .update({ subcategory: newSub.trim() })
      .eq("subcategory", oldSub)
    setEditingSub(null)
    setEditingSubValue("")
    fetchOptions()
    setLoading(false)
  }

  return (
    <div className="space-y-10">
      <Title className="mb-4">Categorization Settings</Title>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-6">
          <Title>Categories</Title>
          <Text className="mb-4">Manage all available categories for invoice classification.</Text>
          <form
            onSubmit={e => {
              e.preventDefault()
              addCategory()
            }}
            className="flex gap-2 mb-6"
          >
            <Input
              value={catInput}
              onChange={e => setCatInput(e.target.value)}
              placeholder="Add new category"
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" color="blue" disabled={loading || !catInput.trim()}>Add</Button>
          </form>
          <Divider className="my-4" />
          <List>
            {categories.map(cat => (
              <ListItem key={cat} className="flex items-center gap-3">
                {editingCat === cat ? (
                  <>
                    <Input
                      value={editingCatValue}
                      onChange={e => setEditingCatValue(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter") saveEditCategory(cat, editingCatValue)
                        if (e.key === "Escape") setEditingCat(null)
                      }}
                      disabled={loading}
                    />
                    <Button color="blue" onClick={() => saveEditCategory(cat, editingCatValue)} disabled={loading}>Save</Button>
                    <Button color="gray" onClick={() => setEditingCat(null)} disabled={loading}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Badge color="blue" className="text-base px-3 py-2">{cat}</Badge>
                    <Button color="gray" onClick={() => { setEditingCat(cat); setEditingCatValue(cat) }} disabled={loading}>Edit</Button>
                  </>
                )}
              </ListItem>
            ))}
            {categories.length === 0 && <Text className="text-gray-400">No categories yet.</Text>}
          </List>
        </Card>
        <Card className="p-6">
          <Title>Subcategories</Title>
          <Text className="mb-4">Manage all available subcategories for invoice classification.</Text>
          <form
            onSubmit={e => {
              e.preventDefault()
              addSubcategory()
            }}
            className="flex gap-2 mb-6"
          >
            <Input
              value={subInput}
              onChange={e => setSubInput(e.target.value)}
              placeholder="Add new subcategory"
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" color="indigo" disabled={loading || !subInput.trim()}>Add</Button>
          </form>
          <Divider className="my-4" />
          <List>
            {subcategories.map(sub => (
              <ListItem key={sub} className="flex items-center gap-3">
                {editingSub === sub ? (
                  <>
                    <Input
                      value={editingSubValue}
                      onChange={e => setEditingSubValue(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter") saveEditSubcategory(sub, editingSubValue)
                        if (e.key === "Escape") setEditingSub(null)
                      }}
                      disabled={loading}
                    />
                    <Button color="indigo" onClick={() => saveEditSubcategory(sub, editingSubValue)} disabled={loading}>Save</Button>
                    <Button color="gray" onClick={() => setEditingSub(null)} disabled={loading}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Badge color="indigo" className="text-base px-3 py-2">{sub}</Badge>
                    <Button color="gray" onClick={() => { setEditingSub(sub); setEditingSubValue(sub) }} disabled={loading}>Edit</Button>
                  </>
                )}
              </ListItem>
            ))}
            {subcategories.length === 0 && <Text className="text-gray-400">No subcategories yet.</Text>}
          </List>
        </Card>
      </div>
    </div>
  )
} 