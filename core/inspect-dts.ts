import * as fs from 'fs';
import * as path from 'path';

const dtsPath = path.resolve('node_modules/@meteora-ag/dynamic-bonding-curve-sdk/dist/index.d.ts');
const content = fs.readFileSync(dtsPath, 'utf8');

function extractDeclaration(name: string): string {
  // Regex to find declare function, export function, type, interface, class etc.
  const regex = new RegExp(`(?:export\\s+)?(?:declare\\s+)?(?:function|type|interface|class|const|enum)\\s+${name}\\b[^;{]+(?:;|(?:\\{[^}]*\\}))`, 'g');
  const matches = content.match(regex);
  if (matches) {
    return matches.slice(0, 3).join('\n---\n');
  }
  return 'NOT FOUND';
}

function searchLines(query: string, maxResults = 10): string[] {
  const lines = content.split('\n');
  const results: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(query)) {
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 8);
      results.push(`Line ${i + 1}:\n` + lines.slice(start, end).join('\n'));
      if (results.length >= maxResults) break;
    }
  }
  return results;
}

console.log('=== TARGET 1: Curve Builders & Config Building ===');
console.log('buildCurveWithMarketCap:');
console.log(searchLines('buildCurveWithMarketCap', 2).join('\n\n'));

console.log('buildCurve:');
console.log(searchLines('function buildCurve(', 2).join('\n\n'));

console.log('buildCurveWithTwoSegments:');
console.log(searchLines('function buildCurveWithTwoSegments(', 2).join('\n\n'));

console.log('buildCurveWithCustomSqrtPrices:');
console.log(searchLines('function buildCurveWithCustomSqrtPrices(', 2).join('\n\n'));

console.log('=== TARGET 2: Reading Curve State and Price ===');
console.log('getPriceFromSqrtPrice:');
console.log(searchLines('function getPriceFromSqrtPrice(', 2).join('\n\n'));

console.log('getSqrtPriceFromPrice:');
console.log(searchLines('function getSqrtPriceFromPrice(', 2).join('\n\n'));

console.log('VirtualPool interface:');
console.log(searchLines('interface VirtualPool {', 2).join('\n\n'));

console.log('=== TARGET 3: Quoting a Swap ===');
console.log('swapQuote2:');
console.log(searchLines('swapQuote2(', 3).join('\n\n'));

console.log('swapQuoteExactIn:');
console.log(searchLines('function swapQuoteExactIn(', 2).join('\n\n'));

console.log('getSwapResult:');
console.log(searchLines('function getSwapResult(', 2).join('\n\n'));

console.log('=== TARGET 4: Computing Fees (Scheduler & Rate Limiter) ===');
console.log('getBaseFeeHandler:');
console.log(searchLines('function getBaseFeeHandler(', 2).join('\n\n'));

console.log('FeeScheduler:');
console.log(searchLines('class FeeScheduler', 2).join('\n\n'));

console.log('FeeRateLimiter:');
console.log(searchLines('class FeeRateLimiter', 2).join('\n\n'));

console.log('=== TARGET 5: Migration Price / DAMM v2 Starting Price ===');
console.log('getMigrationThresholdPrice:');
console.log(searchLines('function getMigrationThresholdPrice(', 2).join('\n\n'));

console.log('migrateToDammV2:');
console.log(searchLines('migrateToDammV2(', 2).join('\n\n'));
