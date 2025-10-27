import fs from 'fs';

// Read CSV
const csvData = fs.readFileSync('/Users/zachstanford/Downloads/Concert Log - Zach.csv', 'utf8');
const lines = csvData.split('\n').filter(line => line.trim() && line.trim() !== '%');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

const headers = parseCSVLine(lines[0]);
console.log('Headers:', headers);

const concerts = [];

for (let i = 1; i < lines.length; i++) {
  const values = parseCSVLine(lines[i]);
  
  if (values.length < 8 || values[0] === '' || values[0] === 'Date') continue;
  
  const dateStr = values[0];
  const concert = values[1].trim();
  const artist = values[2].trim();
  const venue = values[4].trim();
  const rating = values[6] && values[6] !== '' ? parseFloat(values[6]) : null;
  
  // Skip rows with no artist
  if (!artist || artist === '') continue;
  
  // Fix artist name to match music data naming conventions
  const artistFixes = {
    'Panic! At the Disco': 'Panic! At The Disco',
    'For King & Country': 'for KING & COUNTRY',
    'Rocket Summer': 'The Rocket Summer',
    '30 Seconds to Mars': 'Thirty Seconds To Mars',
    'ARIZONA': 'A R I Z O N A',
    'Unlikely Candidates': 'The Unlikely Candidates',
    'Pharrell': 'Pharrell Williams'
  };
  
  if (artistFixes[artist]) {
    artist = artistFixes[artist];
  }
  
  // Convert date from MM/DD/YYYY to YYYY-MM-DD
  let formattedDate;
  try {
    const [month, day, year] = dateStr.split('/');
    if (!month || !day || !year) {
      console.log(`⚠️  Skipping invalid date: ${dateStr}`);
      continue;
    }
    formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch (e) {
    console.log(`⚠️  Error parsing date: ${dateStr}`, e.message);
    continue;
  }
  
  concerts.push({
    date: formattedDate,
    artist: artist,
    concert: concert || artist,
    venue: venue || null,
    vibe_rating: rating
  });
}

// Sort by date descending
concerts.sort((a, b) => b.date.localeCompare(a.date));

fs.writeFileSync('public/data/concerts.json', JSON.stringify(concerts, null, 2));

console.log(`✅ Created concerts.json with ${concerts.length} concerts`);
console.log('\nSample (first 5):');
concerts.slice(0, 5).forEach(c => {
  console.log(`- ${c.date}: ${c.concert} - ${c.artist} at ${c.venue} (${c.vibe_rating || 'N/A'})`);
});

