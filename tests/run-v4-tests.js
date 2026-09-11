'use strict';
const {spawnSync}=require('child_process');
const path=require('path');
const tests=[
  'presentation-v4-core.test.js',
  'presentation-v4-derived.test.js',
  'presentation-v4-catalog.test.js',
  'presentation-v4-dynamic.test.js',
  'presentation-v4-envelope.test.js',
  'presentation-v4-shadow.test.js',
  'presentation-v4-anthropic.test.js',
  'presentation-v4-safety.test.js',
  'presentation-v4-acceptance.test.js',
  'presentation-v4-deploy.test.js',
  'presentation-v4-visible.test.js',
  'presentation-v4-visible-normalize.test.js',
  'presentation-v4-insight-renderer.test.js'
];
for(const file of tests){
  const full=path.join(__dirname,file);
  const r=spawnSync(process.execPath,[full],{stdio:'inherit'});
  if(r.status!==0)process.exit(r.status||1);
}
console.log(`V4 test suite: ${tests.length}/${tests.length} passed`);
