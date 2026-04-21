import { useCallback, useState } from 'react';

interface Result {
  selectionStack: string[];
  selectedNodeId: string | null;
  navDir: 'forward' | 'back';
  pushSelection: (id: string | null) => void;
  popSelection: () => void;
}

/** Navigation stack for the detail panel. pushSelection adds an id (or
 *  clears the stack on null). popSelection removes the top entry. navDir
 *  tells the UI which direction to animate: forward on push, back on pop
 *  and on close. */
export function useSelectionStack(): Result {
  const [selectionStack, setSelectionStack] = useState<string[]>([]);
  const [navDir, setNavDir] = useState<'forward' | 'back'>('forward');
  const selectedNodeId = selectionStack.length ? selectionStack[selectionStack.length - 1] : null;

  const pushSelection = useCallback((id: string | null) => setSelectionStack(prev => {
    if (id === null) { setNavDir('back'); return []; }
    if (prev.length && prev[prev.length - 1] === id) return prev;
    setNavDir('forward');
    return [...prev, id];
  }), []);

  const popSelection = useCallback(() => setSelectionStack(prev => {
    if (!prev.length) return prev;
    setNavDir('back');
    return prev.slice(0, -1);
  }), []);

  return { selectionStack, selectedNodeId, navDir, pushSelection, popSelection };
}
