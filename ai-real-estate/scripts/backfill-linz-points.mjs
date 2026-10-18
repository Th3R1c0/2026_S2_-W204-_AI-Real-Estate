import {readFile,writeFile} from 'node:fs/promises';
import {linzFeatureForAddress} from './property-snapshot.mjs';

const path = new URL('../reports/auckland-property-snapshot.json',import.meta.url);
const snapshot = JSON.parse(await readFile(path,'utf8'));
const endpoint='https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Addresses/FeatureServer/0/query';
for (let i=0;i<snapshot.houses.length;i+=20) {
  const batch=snapshot.houses.slice(i,i+20);
  const where='address_id IN ('+batch.map(h=>h.addressId).join(',')+')';
  const params=new URLSearchParams({where,outFields:'address_id,full_address,address_lifecycle',outSR:'4326',returnGeometry:'true',f:'json'});
  const response=await fetch(endpoint+'?'+params,{signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new Error('LINZ HTTP '+response.status);
  const data=await response.json();
  if(data.error) throw new Error(data.error.message);
  for(const house of batch){
    const verified=linzFeatureForAddress(house.address,data.features||[]);
    if(!verified || verified.addressId!==house.addressId) throw new Error('LINZ point mismatch: '+house.address);
    house.latitude=verified.latitude;
    house.longitude=verified.longitude;
  }
  console.log('Official points',Math.min(i+20,snapshot.houses.length),'/',snapshot.houses.length);
}
await writeFile(path,JSON.stringify(snapshot,null,2));
