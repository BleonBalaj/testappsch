import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';
import {translate} from '../features/lessonPlans/i18n.js';

// Render the same component used by preview and print/PDF without a browser.
const file=new URL('./LessonPlanDocument.jsx',import.meta.url);
const source=(await readFile(file,'utf8'))
 .replace("'react'",JSON.stringify(import.meta.resolve('react')))
 .replace("'../features/lessonPlans/i18n.js'",JSON.stringify(new URL('../features/lessonPlans/i18n.js',import.meta.url).href));
const {code}=await transformWithOxc(source,file.pathname,{jsx:{runtime:'classic'}});
const {default:LessonPlanDocument}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const render=(date,language)=>renderToStaticMarkup(React.createElement(LessonPlanDocument,{plan:{teacherName:'Arta Hoxha',academicYear:'2026/2027',lessonUnit:'Numrat',date},language}));

for(const language of ['en','sq']){
 test(`blank lesson dates omit the entire date metadata in the canonical ${language} document`,()=>{
  for(const date of ['',undefined,null,'   ']){
   const html=render(date,language);
   const metadata=html.match(/<div class="lesson-document-meta">(.*?)<\/div>/s)?.[1];
   assert.ok(metadata);assert.ok(!metadata.includes(translate(language,'document.date')));
   assert.match(metadata,/Arta Hoxha/);assert.match(metadata,/2026\/2027/);
   assert.equal((metadata.match(/<span>/g)||[]).length,2);
  }
 });
 test(`a selected lesson date remains visible and formatted in the canonical ${language} document`,()=>{
  const html=render('2026-10-17',language);
  assert.ok(html.includes(translate(language,'document.date')));
  assert.ok(html.includes(language==='sq'?'17.10.2026':'17 Oct 2026'));
 });
 test(`lesson period is never rendered in the canonical ${language} document`,()=>{
  const html=renderToStaticMarkup(React.createElement(LessonPlanDocument,{plan:{teacherName:'Arta Hoxha',academicYear:'2026/2027',lessonUnit:'Numrat',period:'3',date:'2026-10-17'},language}));
  const metadata=html.match(/<div class="lesson-document-meta">(.*?)<\/div>/s)?.[1];
  assert.ok(metadata);
  assert.ok(!metadata.includes(translate(language,'document.period')));
 });
}
