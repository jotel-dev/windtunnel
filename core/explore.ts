import * as DBCSDK from '@meteora-ag/dynamic-bonding-curve-sdk';

console.log('=== EXPLORING @meteora-ag/dynamic-bonding-curve-sdk ===');
console.log('Export count:', Object.keys(DBCSDK).length);

const keys = Object.keys(DBCSDK).sort();
for (const key of keys) {
  const val = (DBCSDK as Record<string, unknown>)[key];
  const typeStr = typeof val;
  if (typeStr === 'function' && typeof val === 'function') {
    const isClass = /^class\s/.test(Function.prototype.toString.call(val));
    console.log(`[${isClass ? 'CLASS' : 'FUNCTION'}] ${key}`);
    const staticProps = Object.getOwnPropertyNames(val).filter(
      (p) => !['length', 'name', 'prototype'].includes(p)
    );
    if (staticProps.length > 0) {
      console.log(`  Static props: ${staticProps.join(', ')}`);
    }
  } else if (typeStr === 'object' && val !== null) {
    console.log(`[OBJECT] ${key}:`, Object.keys(val as object).slice(0, 10).join(', '));
  } else {
    console.log(`[${typeStr.toUpperCase()}] ${key} =`, val);
  }
}
