import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';

const moduleUrl=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const component=new URL('./LessonPlanFeedback.jsx',import.meta.url);
const indicator=(await readFile(new URL('./ReadStatus.jsx',import.meta.url),'utf8'))
 .replace("'react'",JSON.stringify(import.meta.resolve('react')))
 .replace("'lucide-react'",JSON.stringify(import.meta.resolve('lucide-react'))).replace("import './ReadStatus.css';",'');
const statusUrl=moduleUrl((await transformWithOxc(indicator,'ReadStatus.jsx',{jsx:{runtime:'classic'}})).code);
// Render the actual conversation with controlled read lifecycles. The stubs
// replace network/context/portal boundaries; the empty/loading UI is unchanged.
const dependencies=`
import React,{useRef,useState} from ${JSON.stringify(import.meta.resolve('react'))};
import {MessageSquare,Send} from ${JSON.stringify(import.meta.resolve('lucide-react'))};
import ReadStatus from ${JSON.stringify(statusUrl)};
import {emptyReadReady} from ${JSON.stringify(new URL('../features/liveResource.js',import.meta.url).href)};
const words=(language,en,sq)=>language==='sq'?sq:en,workflowTime=()=> '12:00';
const useAuth=()=>({currentUser:{uid:'owner'},currentRole:'teacher'});
const usePlanActivity=()=>({review:null,loading:false,error:null,retry:()=>{}});
const useWorkflowAction=()=>({busy:false,error:null});
const useWorkflowDocument=()=>({value:{ownerUid:'owner'},hasLoaded:true,loading:false,error:null});
const useWorkflowList=()=>globalThis.lessonFeedbackReadFixture;
const PlanReviewer=()=>null,PlanReadMarker=()=>null,PlanUnreadDot=()=>null;
const WorkflowDialog=({children,footer})=>React.createElement('section',null,children,footer);
const WorkflowField=({label,children})=>React.createElement('label',null,label,children);
const WorkflowError=({error})=>error?React.createElement('p',{role:'alert'},'Read failed'):null;
`;
const source=dependencies+(await readFile(component,'utf8')).replace(/^import .*;\r?\n/gm,'');
const {LessonPlanFeedbackDialog}=await import(moduleUrl((await transformWithOxc(source,component.pathname,{jsx:{runtime:'classic'}})).code));
const render=(state,language='en')=>{
 globalThis.lessonFeedbackReadFixture={rows:[],loading:false,refreshing:false,hasLoaded:false,error:null,...state};
 try{return renderToStaticMarkup(React.createElement(LessonPlanFeedbackDialog,{schoolId:'s1',planId:'p1',language,onClose:()=>{}}));}
 finally{delete globalThis.lessonFeedbackReadFixture;}
};
for(const language of ['en','sq'])test(`actual ${language} comments show loading before verified emptiness and keep cached messages during refresh`,()=>{
 const empty=language==='sq'?'Ende nuk ka komente':'No comments yet';
 const cold=render({loading:true},language);assert.match(cold,/role="status"/);assert.ok(!cold.includes(empty));
 const refreshing=render({hasLoaded:true,refreshing:true},language);assert.ok(!refreshing.includes(empty));
 assert.ok(render({hasLoaded:true},language).includes(empty));
 const warm=render({hasLoaded:true,refreshing:true,rows:[{id:'c1',actorUid:'owner',actorName:'Arta',message:'Please check the final exercise.'}]},language);
 assert.ok(warm.includes('Please check the final exercise.'));assert.ok(warm.includes('Arta'));assert.match(warm,/role="status"/);
 const failed=render({error:{code:'unavailable'}},language);assert.match(failed,/role="alert"/);assert.ok(!failed.includes(empty));
});
