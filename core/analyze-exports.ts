import * as DBCSDK from '@meteora-ag/dynamic-bonding-curve-sdk';
import * as fs from 'fs';

const exportsInfo: Record<string, { type: string; details?: any }> = {};

for (const key of Object.keys(DBCSDK).sort()) {
  const val = (DBCSDK as any)[key];
  const t = typeof val;
  if (t === 'function') {
    const isClass = /^class\s/.test(Function.prototype.toString.call(val));
    const staticMethods = Object.getOwnPropertyNames(val).filter(
      (p) => !['length', 'name', 'prototype'].includes(p)
    );
    exportsInfo[key] = {
      type: isClass ? 'class' : 'function',
      details: {
        staticMethods,
        prototypeMethods: isClass
          ? Object.getOwnPropertyNames(val.prototype).filter((p) => p !== 'constructor')
          : undefined,
      },
    };
  } else if (t === 'object' && val !== null) {
    exportsInfo[key] = {
      type: 'object',
      details: Object.keys(val),
    };
  } else {
    exportsInfo[key] = {
      type: t,
      details: val,
    };
  }
}

fs.writeFileSync('exports.json', JSON.stringify(exportsInfo, null, 2));
console.log(`Saved ${Object.keys(exportsInfo).length} exports to exports.json`);
