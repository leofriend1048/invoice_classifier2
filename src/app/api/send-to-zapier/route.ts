import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Convert is_paid boolean to 'yes' or 'no'
    if (typeof body.is_paid === 'boolean') {
      body.is_paid = body.is_paid ? 'yes' : 'no'
    }

    const zapierUrl = 'https://hooks.zapier.com/hooks/catch/10570360/2viegum/'
    await fetch(zapierUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Zapier error:', err)
    return NextResponse.json({ success: false, error: 'Failed to send to Zapier' }, { status: 500 })
  }
} 