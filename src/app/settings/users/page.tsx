"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { authClient } from "@/lib/auth-client"
import { createClient } from '@supabase/supabase-js'
import { Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from 'react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function Users() {
  // Google Connect State
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleStatus, setGoogleStatus] = useState<'connected' | 'not_connected' | 'loading'>('not_connected');
  const [showSuccess, setShowSuccess] = useState(false);
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

  // On mount, load last used email from localStorage and check status ONCE
  useEffect(() => {
    const lastEmail = typeof window !== 'undefined' ? localStorage.getItem('googleEmail') : '';
    if (lastEmail) {
      setGoogleEmail(lastEmail);
      checkGoogleStatus(lastEmail);
    }
    // Show success message if redirected from OAuth
    if (searchParams && searchParams.get('google_connected') === '1') {
      setShowSuccess(true);
      // Remove the param from the URL after showing
      const url = new URL(window.location.href);
      url.searchParams.delete('google_connected');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []); // Only run on mount

  // Check connection status (call API)
  async function checkGoogleStatus(email: string) {
    setGoogleStatus('loading');
    const res = await fetch(`/api/gmail/status?user_email=${encodeURIComponent(email)}`);
    const data = await res.json();
    setGoogleStatus(data.connected ? 'connected' : 'not_connected');
  }

  // Connect Google
  function connectGoogle() {
    if (!googleEmail) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('googleEmail', googleEmail);
    }
    const redirect = window.location.pathname;
    window.location.href = `/api/gmail/oauth2initiate?user_email=${encodeURIComponent(googleEmail)}&redirect=${encodeURIComponent(redirect)}`;
  }

  // Disconnect Google
  async function disconnectGoogle() {
    setGoogleStatus('loading');
    await fetch(`/api/gmail/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: googleEmail })
    });
    setGoogleStatus('not_connected');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('googleEmail');
    }
  }

  // When user changes email, check status
  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setGoogleEmail(e.target.value);
    if (e.target.value) {
      checkGoogleStatus(e.target.value);
    } else {
      setGoogleStatus('not_connected');
    }
  }

  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserFirstName, setNewUserFirstName] = useState('')
  const [newUserLastName, setNewUserLastName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [addSuccess, setAddSuccess] = useState<string | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Load users from Supabase
  useEffect(() => {
    async function fetchUsers() {
      setLoading(true)
      const { data } = await supabase.from('user').select('id, name, email, "createdAt"')
      setUsers(data || [])
      setLoading(false)
    }
    fetchUsers()
  }, [])

  // Add user handler
  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      // Create the user with admin invitation flag
      const userResult = await authClient.admin.createUser(
        {
          email: newUserEmail,
          name: `${newUserFirstName} ${newUserLastName}`.trim(),
          password: Math.random().toString(36).slice(-12),
          data: { 
            callbackURL: "/login",
            isAdminInvited: true // Flag to skip verification email
          },
        }
      );
      
      // Manually set emailVerified=true for admin-invited users
      if (userResult.data?.user?.id) {
        console.log('Setting emailVerified=true for admin-invited user:', userResult.data.user.id);
        const { error: updateError } = await supabase
          .from('user')
          .update({ emailVerified: true })
          .eq('id', userResult.data.user.id);
        
        if (updateError) {
          console.error('Failed to set emailVerified=true:', updateError);
        } else {
          console.log('Successfully set emailVerified=true for user:', userResult.data.user.id);
        }
      }
      
      // Send password reset email with token using Better Auth
      await authClient.forgetPassword({
        email: newUserEmail,
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password`,
      });
      
      setAddDialogOpen(false);
      setNewUserEmail('');
      setNewUserFirstName('');
      setNewUserLastName('');
      setAddSuccess('User invited! They will receive an email to set their password.');
      
      // Refresh users
      const { data: usersData } = await supabase.from('user').select('id, name, email, "createdAt"');
      setUsers(usersData || []);
    } catch (err: any) {
      setAddError(err.message || 'Failed to invite user');
    }
    setAddLoading(false);
  }

  // Delete user handler
  async function handleDeleteUser(id: string) {
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Failed to delete user');
      setDeleteUserId(null);
      // Refresh users
      const { data } = await supabase.from('user').select('id, name, email, "createdAt"');
      setUsers(data || []);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
    setDeleteLoading(false);
  }

  return (
    <section aria-labelledby="members-heading">
      {/* Google Account Connection Section */}
      {showSuccess && (
        <div className="mb-4 rounded bg-green-100 p-4 text-green-800 flex items-center justify-between">
          <span>Google account connected successfully!</span>
          <button onClick={() => setShowSuccess(false)} className="ml-4 text-green-900 font-bold">×</button>
        </div>
      )}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-2">Google Account Connection</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="email"
            placeholder="Enter your Google email"
            value={googleEmail}
            onChange={handleEmailChange}
            className="max-w-xs"
          />
          <Button
            type="button"
            variant="primary"
            onClick={connectGoogle}
            disabled={!googleEmail || googleStatus === 'loading'}
            className="flex items-center justify-center"
          >
            {googleStatus === 'loading' ? (
              <span className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Checking...
              </span>
            ) : (
              'Connect Google'
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={disconnectGoogle}
            disabled={googleStatus !== 'connected'}
          >
            Disconnect
          </Button>
          <span className="ml-4 text-sm">
            Status: {googleStatus === 'connected' ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() => checkGoogleStatus(googleEmail)}
          disabled={!googleEmail}
        >
          Check Connection
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
        <div>
          <h2
            id="members-heading"
            className="scroll-mt-10 font-semibold text-gray-900 dark:text-gray-50"
          >
            Members
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Invite employees to Insights and manage their permissions to
            streamline expense management.
          </p>
        </div>
        <div className="md:col-span-2">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h3
              id="users-list-heading"
              className="text-sm font-medium text-gray-900 dark:text-gray-50"
            >
              Users with approval rights
            </h3>
            <div className="flex items-center gap-4">
              <Button onClick={() => setAddDialogOpen(true)} className="w-full gap-2 sm:w-fit">
                <Plus className="-ml-1 size-4 shrink-0" aria-hidden="true" />
                Add user
              </Button>
            </div>
          </div>
          <TableRoot className="mt-6" aria-labelledby="users-list-heading">
            <Table className="border-transparent dark:border-transparent">
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="w-full text-xs font-medium uppercase">Name / Email</TableHeaderCell>
                  <TableHeaderCell className="text-xs font-medium uppercase">Date added</TableHeaderCell>
                  <TableHeaderCell className="text-xs font-medium uppercase"><span className="sr-only">Actions</span></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={3}>Loading...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={3}>No users found.</TableCell></TableRow>
                ) : users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="w-full">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-50">{user.name || user.email}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''}</TableCell>
                    <TableCell>
                      <Dialog open={deleteUserId === user.id} onOpenChange={open => setDeleteUserId(open ? user.id : null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            className="p-2.5 text-gray-600 transition-all hover:border hover:border-gray-300 hover:bg-gray-50 hover:text-red-500 dark:text-gray-400 hover:dark:border-gray-800 hover:dark:bg-gray-900 hover:dark:text-red-500"
                            aria-label={`Delete ${user.name || user.email}`}
                          >
                            <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Please confirm</DialogTitle>
                            <DialogDescription className="mt-1 text-sm leading-6">
                              Are you sure you want to delete {user.name || user.email}? This action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="mt-6">
                            <DialogClose asChild>
                              <Button className="mt-2 w-full sm:mt-0 sm:w-fit" variant="secondary">Cancel</Button>
                            </DialogClose>
                            <Button className="w-full sm:w-fit" variant="destructive" onClick={() => handleDeleteUser(user.id)} disabled={deleteLoading}>
                              {deleteLoading ? 'Deleting...' : 'Delete'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRoot>
        </div>
      </div>
      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6">Fill in the details below to invite a new user.</DialogDescription>
          </DialogHeader>
          <form className="mt-4 space-y-4" onSubmit={handleAddUser}>
            <div>
              <Label htmlFor="new-user-first-name" className="font-medium">First Name</Label>
              <Input id="new-user-first-name" type="text" name="first-name" className="mt-2" placeholder="First Name" value={newUserFirstName} onChange={e => setNewUserFirstName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="new-user-last-name" className="font-medium">Last Name</Label>
              <Input id="new-user-last-name" type="text" name="last-name" className="mt-2" placeholder="Last Name" value={newUserLastName} onChange={e => setNewUserLastName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="new-user-email" className="font-medium">Email</Label>
              <Input id="new-user-email" type="email" name="email" className="mt-2" placeholder="Email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required />
            </div>
            {addError && <div className="text-sm text-red-600 dark:text-red-400">{addError}</div>}
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button className="mt-2 w-full sm:mt-0 sm:w-fit" variant="secondary" type="button">Cancel</Button>
              </DialogClose>
              <Button className="w-full sm:w-fit" variant="primary" type="submit" disabled={addLoading}>{addLoading ? 'Inviting...' : 'Invite User'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {addSuccess && (
        <div className="mb-4 rounded bg-green-100 p-4 text-green-800 flex items-center justify-between">
          <span>{addSuccess}</span>
          <button onClick={() => setAddSuccess(null)} className="ml-4 text-green-900 font-bold">×</button>
        </div>
      )}
    </section>
  )
}
