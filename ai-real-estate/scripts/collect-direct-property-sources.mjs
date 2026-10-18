import { readFile, writeFile } from 'node:fs/promises';
import { parseDirectSourcePage, renderDirectReport } from './property-snapshot.mjs';

const snapshot = JSON.parse(await readFile(new URL('../reports/auckland-property-snapshot.json',import.meta.url),'utf8'));
const sites = ['RealEstate','OneRoof','Homes','PropertyValue','QV'];
const configPath = '/tmp/auckland-curl.conf';
const pagePath = (index,site) => `/tmp/auckland-source-${index}-${site}.html`;

if (process.argv.includes('--prepare')) {
  const lines = ['parallel','parallel-max = 5','silent','show-error','location','compressed','max-time = 30','user-agent = "Mozilla/5.0"'];
  let count = 0;
  for (const [index,house] of snapshot.houses.entries()) for (const site of sites) {
    const source = house.sources[site];
    if (!source?.url || ['wrong_address','error'].includes(source.status)) continue;
    lines.push(`url = "${source.url}"`,`output = "${pagePath(index,site)}"`);
    count++;
  }
  await writeFile(configPath,lines.join('\n')+'\n');
  console.log(`${count} public source pages in ${configPath}`);
} else if (process.argv.includes('--assemble')) {
  const houses = [];
  for (const [index,house] of snapshot.houses.entries()) {
    const sources = {};
    for (const site of [...sites,'TradeMe']) {
      const entry = house.sources[site];
      if (!entry?.url || ['wrong_address','error'].includes(entry.status)) {
        sources[site] = {status:'unavailable',reason:'No verified source URL'};
        continue;
      }
      if (site === 'TradeMe') {
        sources[site] = {status:'unverified',url:entry.url,reason:'Public page did not expose address-specific facts'};
        continue;
      }
      try {
        const html = await readFile(pagePath(index,site),'utf8');
        sources[site] = {url:entry.url,...parseDirectSourcePage(site,html,house.address)};
        if (sources[site].images) sources[site].images = sources[site].images.slice(0,12);
      } catch(error) {
        sources[site] = {status:'error',url:entry.url,reason:String(error.message).slice(0,120)};
      }
    }
    houses.push({addressId:house.addressId,address:house.address,latitude:house.latitude,longitude:house.longitude,sources});
  }
  const output = {collectedAt:new Date().toISOString(),method:'Direct public website pages; source URLs originally discovered in earlier research; no PropValues data requests',houses};
  await writeFile(new URL('../reports/auckland-direct-sources.json',import.meta.url),JSON.stringify(output,null,2));
  await writeFile(new URL('../reports/auckland-property-snapshot.html',import.meta.url),renderDirectReport(houses));
  console.log(Object.fromEntries(sites.map(site => [site,houses.filter(h => h.sources[site].status === 'matched').length])));
} else {
  console.log('Usage: node scripts/collect-direct-property-sources.mjs --prepare | --assemble');
}
