import { getServerSession } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const session = await getServerSession()
  
  if (session?.session) {
    redirect('/reports')
  } else {
    redirect('/login')
  }
} 