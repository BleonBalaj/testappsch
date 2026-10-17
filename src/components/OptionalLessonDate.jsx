import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CalendarDays} from 'lucide-react';
import {dateInTimeZone} from '../features/lessonPlans/plan';
import {translate} from '../features/lessonPlans/i18n';
import './OptionalLessonDate.css';

export default function OptionalLessonDate({value,onChange,language}){
  const t=key=>translate(language,key),id=useId(),trigger=useRef(null),popup=useRef(null);
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(value),[position,setPosition]=useState(null);
  const close=()=>{setOpen(false);trigger.current?.focus({preventScroll:true});};
  const pick=date=>{onChange(date);close();};
  useEffect(()=>{
    if(!open)return;
    const place=()=>{
      const box=trigger.current.getBoundingClientRect(),width=Math.min(Math.max(box.width,280),window.innerWidth-24);
      const below=window.innerHeight-box.bottom-16,above=box.top-16,upward=below<260&&above>below;
      let zIndex=6000;for(let node=trigger.current.parentElement;node;node=node.parentElement)zIndex=Math.max(zIndex,(parseInt(getComputedStyle(node).zIndex,10)||0)+1);
      setPosition({width,zIndex,left:Math.max(12,Math.min(box.left,window.innerWidth-width-12)),maxHeight:Math.max(100,upward?above:below),...(upward?{bottom:window.innerHeight-box.top+7}:{top:box.bottom+7})});
    };
    const outside=event=>{if(!trigger.current?.contains(event.target)&&!popup.current?.contains(event.target))setOpen(false);};
    const scroll=event=>{if(!popup.current?.contains(event.target))place();};
    place();document.addEventListener('pointerdown',outside,true);window.addEventListener('resize',place);window.addEventListener('scroll',scroll,true);
    return()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',place);window.removeEventListener('scroll',scroll,true);};
  },[open]);
  useEffect(()=>{if(open&&position&&!popup.current?.contains(document.activeElement))popup.current?.querySelector('button')?.focus({preventScroll:true});},[open,position]);
  const keyDown=event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    if(event.key==='Tab'){
      const nodes=[...popup.current.querySelectorAll('button:not(:disabled),input:not(:disabled)')],first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  };
  return <div className="lesson-date-control"><button ref={trigger} type="button" className={`lesson-date-trigger${value?'':' is-empty'}`} aria-label={t('editor.optionalDate')} aria-expanded={open} aria-haspopup="dialog" aria-controls={`${id}-popup`} onClick={()=>{setDraft(value);setPosition(null);setOpen(previous=>!previous);}}><CalendarDays size={17}/><span>{value?value.split('-').reverse().join('.'):t('editor.chooseDate')}</span></button>
    {open&&createPortal(<div ref={popup} role="dialog" aria-modal="false" aria-label={t('editor.optionalDate')} id={`${id}-popup`} className="lesson-date-popover" style={position||{visibility:'hidden'}} onKeyDown={keyDown}>
      <button type="button" className="lesson-date-today" onClick={()=>pick(dateInTimeZone())}><CalendarDays size={17}/>{t('date.today')}</button>
      <label htmlFor={`${id}-date`}>{t('editor.chooseDate')}</label><input id={`${id}-date`} type="date" value={draft} onChange={event=>setDraft(event.target.value)}/>
      <div className="lesson-date-actions"><button type="button" className="btn-primary" disabled={!draft} onClick={()=>pick(draft)}>{t('editor.useDate')}</button>{value&&<button type="button" className="text-btn" onClick={()=>pick('')}>{t('editor.clearDate')}</button>}</div>
      <p>{t('editor.dateOmitted')}</p>
    </div>,document.body)}
  </div>;
}
