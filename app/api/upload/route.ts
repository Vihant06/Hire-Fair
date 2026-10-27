import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const name = file.name.toLowerCase()
    let text = ''

    if (name.endsWith('.txt')) {
      text = buffer.toString('utf-8')
    } else if (name.endsWith('.pdf')) {
      // Simple PDF text extraction (basic, for demo)
      text = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim()
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      // Basic docx text extraction (zip-based, simplified)
      text = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim()
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use .txt, .pdf, or .docx' }, { status: 400 })
    }

    if (!text || text.length < 10) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 })
    }

    return NextResponse.json({ text, fileName: file.name })
  } catch (e) {
    return NextResponse.json({ error: 'File processing failed' }, { status: 500 })
  }
}