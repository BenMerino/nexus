// BaseAction — the interactive primitive (Phase 2): buttons and link-styled
// actions. Rather than re-declare button styling inline, it renders the
// element with the button classes shared.css already defines (the base
// `button`, `.primary`/`button.primary`, `.secondary`, `.link-btn`), so
// there's still one source of truth for how a button looks. The variant
// prop just selects among those existing classes.

import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'link';

export interface BaseActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

// Maps a semantic variant to the class(es) shared.css styles.
//   primary   → accent fill (.primary)
//   secondary → bordered, transparent (.secondary)
//   ghost     → the bare base `button` look (no extra class)
//   link      → text-only action (.link-btn)
const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: '',
  link: 'link-btn',
};

export function BaseAction({
  variant = 'primary', className, children, ...rest
}: BaseActionProps) {
  const cls = [VARIANT_CLASS[variant], className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
