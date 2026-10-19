import { test, expect } from 'vitest';
import { aucklandProperties as properties, forSaleProperties } from '../lib/property-data';
import direct from '../reports/auckland-direct-sources.json';

test('seed houses use directly collected prices, photos and LINZ map points', () => {
  expect(properties).toHaveLength(50);
  const house = properties.find(item => item.address === '59 Israel Avenue');
  const sourceHouse = direct.houses.find(item => item.address.startsWith('59 Israel Avenue'))!;
  expect(house?.price).toBe(sourceHouse.sources.RealEstate.estimate?.medium);
  expect(house?.image).toMatch(/^https:\/\//);
  expect(house?.latitude).toBe(sourceHouse.latitude);
  expect(house?.sources?.some(source => source.publisher === 'Homes')).toBe(true);
});

test('for-sale catalogue contains 40 live properties with full galleries and multi-source provenance', () => {
  expect(forSaleProperties).toHaveLength(40);
  expect(forSaleProperties.every(p => p.price > 0 && p.latitude && p.longitude)).toBe(true);
  expect(forSaleProperties.every(p => p.photoGallery && p.photoGallery.length > 0)).toBe(true);
  expect(forSaleProperties.some(p => p.sources?.some(s => s.publisher === 'OneRoof'))).toBe(true);
  expect(forSaleProperties.some(p => p.sources?.some(s => s.publisher === 'Homes'))).toBe(true);
});

test('each for-sale listing keeps its source agent and enquiry link', () => {
  expect(forSaleProperties).toHaveLength(40);
  expect(forSaleProperties.every(property => property.listingAgent?.name && property.listingAgent.contactUrl === property.imageSourceUrl)).toBe(true);
  expect(forSaleProperties.find(property => property.address === '1/10 Harding Avenue')?.listingAgent).toMatchObject({
    name: 'Kevin Ratnayake',
    source: 'OneRoof',
  });
});

test('unknown zero facts do not override populated direct-source facts', () => {
  expect(properties.find(item => item.address === '72 Stonefields Avenue')?.bathrooms).toBe(1);
  expect(properties.find(item => item.address === '32 Red Hills Road')?.landArea).toBe(10557);
});

test('historical sale shown by a direct page is available in the app history', () => {
  const house = properties.find(item => item.address === '59 Israel Avenue');
  expect(house?.pastSales?.[0]).toMatchObject({price:680000,source:'PropertyValue'});
  expect(house?.pastSales?.[0].date).toBe('2020-08-18');
});

test('year built prefers an exact source year over a decade estimate', () => {
  expect(properties.find(item => item.address === '9 Menear Lane')?.yearBuilt).toBe(1977);
});
