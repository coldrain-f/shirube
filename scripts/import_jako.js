const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const db = new Database('./resources/Ja-Ko_DIC_2018.sqlite');
  
  console.log('Fetching words from source dictionary...');
  const rows = db.prepare('SELECT word, definition FROM Ja_Ko_DIC_2018').all();
  
  console.log(`Found ${rows.length} words. Processing...`);
  
  console.log('Clearing existing staging_words...');
  await prisma.staging_words.deleteMany({
    where: { source: 'Ja-Ko_DIC_2018' }
  });

  const batchSize = 10000;
  let batch = [];
  
  let inserted = 0;
  for (const row of rows) {
    const rawWord = row.word || '';
    const def = row.definition || '';
    
    let term = rawWord;
    let reading = rawWord;
    let meaning = def;
    let pos = '';
    
    // Parse format: 요미가나[한자]<br>뜻풀이
    const match = def.match(/^(.+?)(?:\[(.*?)\])?(?:<br>|<br\/>)([\s\S]*)$/);
    if (match) {
      reading = match[1].trim();
      if (match[2]) {
        term = match[2].trim();
      } else {
        term = reading;
      }
      meaning = match[3].trim();
    } else {
      const brIndex = def.indexOf('<br>');
      if (brIndex !== -1) {
        term = def.substring(0, brIndex).replace(/\[.*?\]/, '').trim();
        meaning = def.substring(brIndex + 4).trim();
      }
    }
    
    // Extract POS if available in meaning string
    const posMatch = meaning.match(/^\[(.*?)\]/);
    if (posMatch) {
      pos = posMatch[1].trim();
    }

    batch.push({
      term: term,
      reading: reading,
      meaning: meaning,
      source: 'Ja-Ko_DIC_2018',
      part_of_speech: pos,
      frequency: 0,
      is_processed: false
    });
    
    if (batch.length >= batchSize) {
      await prisma.staging_words.createMany({
        data: batch
      });
      inserted += batch.length;
      console.log(`Inserted ${inserted} words...`);
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    await prisma.staging_words.createMany({
      data: batch
    });
    inserted += batch.length;
  }
  
  console.log(`Done! Total inserted into staging: ${inserted}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
