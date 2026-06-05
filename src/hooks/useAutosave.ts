import { useEffect, useRef } from 'react';
import { autosaveManager } from '../utils/autosave';

type AutosaveCallback = () => void | Promise<void>;

export function useAutosave(id: string, callback: AutosaveCallback, _deps: any[]) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const wrappedCallback = () => callbackRef.current();
    autosaveManager.register(id, wrappedCallback);
    return () => {
      autosaveManager.unregister(id);
    };
  }, [id]);

  return {
    trigger: () => autosaveManager.trigger(id),
    flush: () => autosaveManager.flush(id),
  };
}
