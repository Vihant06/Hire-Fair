import { NextRequest, NextResponse } from 'next/server'
import { parsePdf, parseDocx, parseTxt } from '@/lib/parse'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain']

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let text = ''

    if (file.type === 'application/pdf') {
      text = await parsePdf(buffer)
    } else if (file.type.includes('word') || file.type === 'application/msword') {
      text = await parseDocx(buffer)
    } else {
      text = parseTxt(buffer)
    }

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 })
    }

    return NextResponse.json({ text: text.trim(), fileName: file.name })
  } catch (e) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'File processing failed' }, { status: 500 })
  }
}