import { it, expect } from "vitest";
import { parseProductionSheets } from "../app/lib/google-sheets";
import fs from "node:fs";
// Optional local integration fixture, not included in the downloadable project.
const path = "../../b2b-live-verified-values.json";
it.skipIf(!fs.existsSync(path))("imports all verified sheet rows without duplicate source keys",()=>{
  const result = parseProductionSheets(JSON.parse(fs.readFileSync(path,"utf8")));
  expect(result.products).toHaveLength(464);
  expect(new Set(result.products.map(p=>p.sourceKey)).size).toBe(464);
  expect(result.skippedRows).toHaveLength(0);
  expect(result.products.filter(p=>p.sheetWholesale)).toHaveLength(9);
  expect(result.products.filter(p=>p.price>0)).toHaveLength(9);
  expect(result.products.filter(p=>p.sourceSheet==='Laptops')).toHaveLength(16);
  expect(result.products.filter(p=>p.sourceSheet==='Accessories')).toHaveLength(110);
  expect(result.products.filter(p=>p.sourceSheet==='PC Parts')).toHaveLength(338);
  for(const p of result.products.filter(p=>p.sheetWholesale)) {
    expect(p.sheetWholesale!.minQuantity).toBe(3);
    expect(p.sheetWholesale!.unitPrice).toBe(Math.round(p.price*0.95));
  }
  console.log('Verified import: 464 unique products, 9 priced, MOQ=3.');
});
