import { useCallback, useState } from 'react';
import { scopedUpdate } from './dataScope.js';

export function useScopedState(scope, initial) {
  const [fallback] = useState(()=>initial);
  const [state, setState] = useState(() => ({ scope, value: initial }));
  if(state.scope!==scope)setState({scope,value:fallback});
  const set = useCallback(update => {
    setState(previous => previous.scope===scope?scopedUpdate(previous, scope, fallback, update):previous);
  }, [scope,fallback]);
  return [state.scope === scope ? state.value : fallback, set];
}
