import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { candidatesFromCsv, linzFeatureForAddress, matchAddress, renderReport, sourceFromResponses } from './property-snapshot.mjs';

const sites = [
  ['RealEstate','realestate',true], ['OneRoof','oneroof',true],
  ['Homes','homes',true], ['TradeMe','trademe',false],
  ['QV','qv',true], ['PropertyValue','propertyvalue',true],
];
const count = 50;
const outputDir = new URL('../reports/', import.meta.url);
const sourceCsv = process.argv[2];
if (!sourceCsv) throw new Error('Pass the path to the Auckland address-bearing CSV.');

async function getJson(url, options) {
  const response = await fetch(url, { ...options, signal:AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).pathname}`);
  return response.json();
}

async function verifyAddresses(candidates) {
  const verified = [];
  const endpoint = 'https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Addresses/FeatureServer/0/query';
  for (let i = 0; i < candidates.length && verified.length < count; i += 20) {
    const batch = candidates.slice(i, i + 20);
    const where = 'full_address IN (' + batch.map(x => "'" + x.address.replaceAll("'", "''") + "'").join(',') + ')';
    const params = new URLSearchParams({where,outFields:'address_id,full_address,address_lifecycle',returnGeometry:'true',outSR:'4326',f:'json'});
    const data = await getJson(endpoint + '?' + params);
    if (data.error) throw new Error('LINZ query failed: ' + data.error.message);
    for (const candidate of batch) {
      const verifiedPoint = linzFeatureForAddress(candidate.address,data.features || []);
      if (verifiedPoint) verified.push({...candidate,...verifiedPoint,sources:{}});
      if (verified.length === count) break;
    }
    console.log(`LINZ: ${verified.length}/${count} verified after ${Math.min(i + 20,candidates.length)} candidates`);
  }
  if (verified.length < count) throw new Error(`Only ${verified.length} addresses were verified by LINZ.`);
  return verified;
}

async function fetchSite(house, [name, slug, shouldScrape]) {
  try {
    const lookup = await getJson(`https://www.propvalues.nz/api/get-${slug}-url`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:house.address})});
    if (!lookup?.url || matchAddress(house.address,lookup.url) !== true || !shouldScrape) return sourceFromResponses(house.address,lookup);
    const url = name === 'RealEstate' ? lookup.data?.platformApiUrl || lookup.url : lookup.url;
    const scraped = await getJson(`https://www.propvalues.nz/api/scrape-${slug}-values`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});
    return sourceFromResponses(house.address,lookup,scraped);
  } catch (error) {
    return {status:'error',error:String(error.message).slice(0,180)};
  }
}

async function save(houses) {
  await mkdir(outputDir,{recursive:true});
  await writeFile(new URL('auckland-property-snapshot.json',outputDir),JSON.stringify({collectedAt:new Date().toISOString(),houses},null,2));
  await writeFile(new URL('auckland-property-snapshot.html',outputDir),renderReport(houses));
}

const candidates = candidatesFromCsv(await readFile(sourceCsv,'utf8'));
const houses = await verifyAddresses(candidates);
for (let i = 0; i < houses.length; i++) {
  const results = await Promise.all(sites.map(site => fetchSite(houses[i],site)));
  houses[i].sources = Object.fromEntries(sites.map((site,j) => [site[0],results[j]]));
  await save(houses);
  console.log(`${i+1}/${houses.length} ${houses[i].address}: ${results.filter(x=>x.status==='matched').length} matched sources`);
}
console.log('Wrote reports/auckland-property-snapshot.html and .json');
