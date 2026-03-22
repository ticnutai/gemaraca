import { readFileSync } from 'fs';
for (const id of ['14399', '14398']) {
  console.log(`\n=== psak ${id} ===`);
  const h = readFileSync(`downloaded-psakim/psak-din-${id}-styled.html`,'utf8');
  const body = h.indexOf('<article');
  const end = h.indexOf('</article>');
  const c = h.substring(body, end+10);
  console.log('Has site footer:', c.includes('id="footer"'));
  console.log('H2 tags:', (c.match(/<h2/g)||[]).length);
  const h2s = c.match(/<h2[^>]*>[^<]+<\/h2>/g);
  console.log('H2 contents:', h2s);
  console.log('End:', c.slice(-150));
}
