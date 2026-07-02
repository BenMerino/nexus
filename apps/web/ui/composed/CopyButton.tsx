import React from 'react';
import { Copy, Check } from '../icons/index.js';
import { BaseAction } from '../primitives/index.js';

export interface CopyButtonProps {
    text: string;
    /** Time (ms) the success state stays visible. Default 1500. */
    successDuration?: number;
    /** Visual variant of the underlying BaseAction. Default 'ghost'. */
    variant?: 'ghost' | 'outline' | 'secondary';
    /** Size. Default 'sm'. */
    size?: 'sm' | 'md';
    /** Optional label rendered next to the icon. If omitted, icon-only. */
    label?: string;
    /** Accessible label for icon-only mode. Default 'Copy'. */
    ariaLabel?: string;
}

/** Copy text to clipboard with a brief success state. Falls back silently if
 *  clipboard API is unavailable. Compose into BaseModal's `headerActions`,
 *  alongside content blocks, etc. */
export const CopyButton: React.FC<CopyButtonProps> = ({
    text,
    successDuration = 1500,
    variant = 'ghost',
    size = 'sm',
    label,
    ariaLabel = 'Copy',
}) => {
    const [copied, setCopied] = React.useState(false);
    const timerRef = React.useRef<number | null>(null);

    React.useEffect(() => () => {
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
    }, []);

    const onCopy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // Older browsers / non-secure contexts — best-effort fallback.
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch { /* noop */ }
            document.body.removeChild(ta);
        }
        setCopied(true);
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), successDuration);
    };

    const Icon = copied ? Check : Copy;
    return (
        <BaseAction variant={variant} size={size} onClick={onCopy} aria-label={ariaLabel}>
            <Icon style={{ width: '1rem', height: '1rem' }} />
            {label && <span style={{ marginLeft: 'var(--space-2)' }}>{copied ? 'Copied' : label}</span>}
        </BaseAction>
    );
};
