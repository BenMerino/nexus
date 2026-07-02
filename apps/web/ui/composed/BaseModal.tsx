import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from '../icons/index.js';
import { BaseBox, BaseText, BaseAction } from '../primitives/index.js';
import './base-modal.css';

export type BaseModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    size?: BaseModalSize;
    showClose?: boolean;
    /** Optional actions rendered inline in the header, before the close X.
     *  Use for context-specific affordances like Copy, Download, Open in new tab. */
    headerActions?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
}

export const BaseModal: React.FC<BaseModalProps> = ({
    isOpen, onClose, title, size = 'md', showClose = true, headerActions, footer, children,
}) => {
    if (typeof document === 'undefined') return null;
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <BaseBox className="base-modal-overlay">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="base-modal-backdrop"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={`base-modal-panel base-modal-panel--${size}`}
                        onClick={e => e.stopPropagation()}
                    >
                        {(title || showClose || headerActions) && (
                            <BaseBox className="base-modal-header">
                                <BaseBox style={{ flex: 1, minWidth: 0 }}>
                                    {typeof title === 'string'
                                        ? <BaseText variant="h3" weight="semibold">{title}</BaseText>
                                        : title}
                                </BaseBox>
                                {headerActions}
                                {showClose && (
                                    <BaseAction variant="ghost" size="sm" onClick={onClose}>
                                        <X style={{ width: '1.25rem', height: '1.25rem' }} />
                                    </BaseAction>
                                )}
                            </BaseBox>
                        )}
                        <BaseBox className="base-modal-body">{children}</BaseBox>
                        {footer && <BaseBox className="base-modal-footer">{footer}</BaseBox>}
                    </motion.div>
                </BaseBox>
            )}
        </AnimatePresence>,
        document.body,
    );
};
