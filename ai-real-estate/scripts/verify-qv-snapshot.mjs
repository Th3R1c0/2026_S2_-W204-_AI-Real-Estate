import {readFile,writeFile} from 'node:fs/promises';
import {cleanEstimate,matchTitleAddress,renderReport} from './property-snapshot.mjs';

const jsonPath = new URL('../reports/auckland-property-snapshot.json',import.meta.url);
const htmlPath = new URL('../reports/auckland-property-snapshot.html',import.meta.url);
const document = JSON.parse(await readFile(jsonPath,'utf8'));
const pending = document.houses.filter(h => h.sources.QV.status === 'unverified');

async function inspect(house) {
  const source = house.sources.QV;
  try {
    const page = await fetch(source.url,{signal:AbortSignal.timeout(25000)});
    if (!page.ok) throw new Error('HTTP ' + page.status);
    const html = await page.text();
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';
    if (!title || title === 'QV') return;
    if (!matchTitleAddress(house.address,title)) {
      source.status = 'wrong_address';
      source.pageTitle = title;
      return;
    }
    source.status = 'matched';
    source.pageTitle = title;
    const response = await fetch('https://www.propvalues.nz/api/scrape-qv-values',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:source.url}),signal:AbortSignal.timeout(25000)
    });
    if (response.ok) {
      const data = await response.json();
      source.estimate = Object.fromEntries(['low','medium','high'].map(k=>[k,cleanEstimate(data.estimatedValues?.[k])]));
    }
  } catch (error) { source.note = String(error.message).slice(0,140); }
}

for (let i=0;i<pending.length;i+=4) {
  await Promise.all(pending.slice(i,i+4).map(inspect));
  console.log('QV checked',Math.min(i+4,pending.length),'/',pending.length);
}
await writeFile(jsonPath,JSON.stringify(document,null,2));
await writeFile(htmlPath,renderReport(document.houses));
