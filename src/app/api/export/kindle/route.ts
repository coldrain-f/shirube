import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import JSZip from 'jszip'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dictionaryId = searchParams.get('dictionaryId')
      ? parseInt(searchParams.get('dictionaryId')!, 10)
      : undefined

    const [entries, dictionary] = await Promise.all([
      prisma.dictionary_entries.findMany({
        where: dictionaryId !== undefined ? { dictionary_id: dictionaryId } : undefined,
      }),
      dictionaryId !== undefined
        ? prisma.dictionaries.findUnique({ where: { id: dictionaryId } })
        : null,
    ])

    const dictTitle = dictionary?.title || 'Shirube Dictionary'

    let htmlContent = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns:math="http://exslt.org/math" xmlns:svg="http://www.w3.org/2000/svg"
      xmlns:idx="https://kindlegen.s3.amazonaws.com/AmazonKindlePublishingGuidelines.pdf"
      xmlns:mbp="https://kindlegen.s3.amazonaws.com/AmazonKindlePublishingGuidelines.pdf">
<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head>
<body>
  <mbp:frameset>
`

    entries.forEach(entry => {
      htmlContent += `
    <idx:entry name="dictionary" scriptable="yes" spell="yes">
      <idx:orth>
        ${entry.term}
        <idx:iform name="inflection" value="${entry.term}"/>
      </idx:orth>
      <div>
        <b>${entry.reading}</b> [${entry.part_of_speech}]<br/>
        ${entry.meaning}
      </div>
    </idx:entry>
    <hr/>`
    })

    htmlContent += `
  </mbp:frameset>
</body>
</html>`

    const opfContent = `<?xml version="1.0" encoding="utf-8"?>
<package unique-identifier="uid">
  <metadata>
    <dc-metadata xmlns:dc="http://purl.org/metadata/dublin_core">
      <dc:Title>${dictTitle}</dc:Title>
      <dc:Language>ja</dc:Language>
    </dc-metadata>
    <x-metadata>
      <DictionaryInLanguage>ja</DictionaryInLanguage>
      <DictionaryOutLanguage>ko</DictionaryOutLanguage>
      <DefaultLookupIndex>dictionary</DefaultLookupIndex>
    </x-metadata>
  </metadata>
  <manifest>
    <item id="content" href="kindle_dict.html" media-type="text/x-oeb1-document"/>
  </manifest>
  <spine>
    <itemref idref="content"/>
  </spine>
</package>`

    const zip = new JSZip()
    zip.file('kindle_dict.html', htmlContent)
    zip.file('shirube_kindle.opf', opfContent)
    zip.file('README.txt', '1. Download kindlegen or mobigen.\n2. Run: kindlegen shirube_kindle.opf\n3. You will get shirube_kindle.mobi which you can send to your Kindle.')

    const zipBuffer = await zip.generateAsync({ type: 'blob' })
    const filename = dictionary
      ? `shirube_${dictionary.name.replace(/\s+/g, '_')}_kindle.zip`
      : 'shirube_kindle_export_src.zip'

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Kindle Export failed' }, { status: 500 })
  }
}
