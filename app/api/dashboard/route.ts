import { NextResponse } from 'next/server'
import { getDashboard } from '@/lib/db'

export async function GET() {
  try {
    const data = getDashboard()
    return NextResponse.json(data)
  } catch (e) {
    console.error('Dashboard error:', e)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}