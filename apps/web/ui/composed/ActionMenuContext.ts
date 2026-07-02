import { createContext } from 'react';

/* Shared by ActionMenu and ActionMenu.Item so a row can close the menu after
 * firing its action — the same Context-coupling Dropdown uses for its items. */
export interface ActionMenuContextValue {
    close: () => void;
}

export const ActionMenuContext = createContext<ActionMenuContextValue | null>(null);
