// PDF parsing using pdf-parse
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

export async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    return data.text
  } catch (e) {
    console.error('PDF parse error:', e)
    return ''
  }
}

export async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (e) {
    console.error('DOCX parse error:', e)
    return ''
  }
}

export function parseTxt(buffer: Buffer): string {
  try {
    return buffer.toString('utf-8')
  } catch (e) {
    console.error('TXT parse error:', e)
    return ''
  }
}