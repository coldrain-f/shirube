import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import JSZip from 'jszip'

export async function GET() {
  try {
    const entries = await prisma.dictionary_entries.findMany()

    let htmlContent = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns:math="http://exslt.org/math" xmlns:svg="http://www.w3.org/2000/svg"
      xmlns:idx="https://kindlegen.s3.amazonaws.com/AmazonKindlePublishingGuidelines.pdf"
      xmlns:mbp="https://kindlegen.s3.amazonaws.com/AmazonKindlePublishingGuidelines.pdf">
<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head>
<body>
  <mbp:frameset>
`

    entries.forEach(entry => {
      // Basic Kindle entry structure
      htmlContent += `
    <idx:entry name="dictionary" scriptable="yes" spell="yes">
      <idx:orth>
        ${entry.term}
        <idx:iform name="inflection" value="${entry.term}"/>
        <!-- Basic placeholder for future de-inflection rules based on ${entry.part_of_speech} -->
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
      <dc:Title>Shirube Dictionary</dc:Title>
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
    
    // Add a basic readme with instructions
    zip.file('README.txt', '1. Download kindlegen or mobigen.\n2. Run: kindlegen shirube_kindle.opf\n3. You will get shirube_kindle.mobi which you can send to your Kindle.')

    const zipBuffer = await zip.generateAsync({ type: 'blob' })

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="shirube_kindle_export_src.zip"'
      }
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Kindle Export failed' }, { status: 500 })
  }
}
