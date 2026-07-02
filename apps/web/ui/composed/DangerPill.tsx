import React from 'react';
import { BaseAction } from '../primitives/index.js';

interface DangerPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: React.ReactNode;
    children: React.ReactNode;
}

/* The low-emphasis destructive weight: a thin alias over BaseAction
 * variant="danger-soft" (the soft status weight — outline in --status-error,
 * fills on hover, deepens on press). The outline-fill treatment now lives in the
 * cascade as a parameterized variant, not a bespoke danger-pill.css; this just
 * names the danger tone + sm size for the common inline "Remove"/"Cancel" call.
 * For the other tones use BaseAction variant="warning-soft|success-soft|info-soft". */
export function DangerPill({ icon, children, ...props }: DangerPillProps) {
    return (
        <BaseAction type="button" variant="danger-soft" size="sm" leftIcon={icon} {...props}>
            {children}
        </BaseAction>
    );
}

export default DangerPill;
