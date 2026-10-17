export const activityMillis=value=>(value?.toMillis?.()??new Date(value||0).getTime())||0;
export function compareCursors(a,b) { return activityMillis(a?.at)-activityMillis(b?.at)||(Number(a?.at?.nanoseconds||0)%1000000)-(Number(b?.at?.nanoseconds||0)%1000000)||String(a?.id||'').localeCompare(String(b?.id||'')); }
export const activityHead=(value,kind)=>({at:value?.[`${kind}At`],id:value?.[`${kind}EventId`]||''});
export const activitySeen=(value,kind)=>({at:value?.[`seen${kind}At`],id:value?.[`seen${kind}EventId`]||''});
export const hasUnreadActivity=(value,kind)=>Boolean(activityHead(value,kind).id)&&compareCursors(activityHead(value,kind),activitySeen(value,kind))>0;
