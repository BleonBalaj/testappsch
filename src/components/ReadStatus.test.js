import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';

const file=new URL('./ReadStatus.jsx',import.meta.url);
const source=(await readFile(file,'utf8'))
 .replace("'react'",JSON.stringify(import.meta.resolve('react')))
 .replace("'lucide-react'",JSON.stringify(import.meta.resolve('lucide-react')))
 .replace("import './ReadStatus.css';",'');
const {code}=await transformWithOxc(source,file.pathname,{jsx:{runtime:'classic'}});
const {default:ReadStatus}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const render=(state,language='en')=>renderToStaticMarkup(React.createElement(ReadStatus,{state,language}));

for(const language of ['en','sq']){
 test(`first-load has visible accessible ${language} text while warm cached data renders without extra loading indicator`,()=>{
  const cold=render({loading:true,hasLoaded:false,rows:[]},language);
  assert.match(cold,/role="status"/);assert.match(cold,/<svg/);assert.ok(cold.includes(language==='sq'?'Duke ngarkuar':'Loading'));
  const warm=render({refreshing:true,rows:[{id:'saved'}]},language);
  assert.equal(warm,'');
  const empty=render({refreshing:true,rows:[]},language);
  assert.equal(empty,'');
  const cachedLoaded=render({loading:true,hasLoaded:true,rows:[]},language);
  assert.equal(cachedLoaded,'');
 });
 test(`settled and failed ${language} reads never continue claiming to load`,()=>{
  assert.equal(render({loading:false,refreshing:false,rows:[]},language),'');
  assert.equal(render({loading:true,error:{code:'unavailable'}},language),'');
 });
}
