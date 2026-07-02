import React from 'react';
import { AlertCircle, HelpCircle, AlertTriangle } from '../icons/index.js';
import { BaseBox, BaseText } from '../primitives/index.js';
import { BaseModal } from './BaseModal.js';
import { Button } from './Button.js';
import './confirmation-modal.css';

export type ConfirmationModalType = 'warning' | 'danger' | 'info';

export interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
    type?: ConfirmationModalType;
}

const ICONS = { warning: HelpCircle, danger: AlertTriangle, info: AlertCircle };
const ICON_COLOR_VAR = {
    warning: 'var(--status-warning)',
    danger: 'var(--status-error)',
    info: 'var(--status-info)',
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen, onClose, onConfirm, title, message,
    confirmLabel = 'Confirm', cancelLabel = 'Cancel',
    showCancel = true, type = 'warning',
}) => {
    const Icon = ICONS[type];
    const buttonVariant = type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : 'primary';
    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            title={
                <BaseBox display="flex" align="center" density="tight">
                    <BaseBox className={`confirm-icon--${type}`}>
                        <Icon style={{ width: '1.5rem', height: '1.5rem', color: ICON_COLOR_VAR[type] }} />
                    </BaseBox>
                    <BaseText variant="h2" weight="bold">{title}</BaseText>
                </BaseBox>
            }
            footer={
                <>
                    {showCancel && <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>}
                    <Button variant={buttonVariant} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
                </>
            }
        >
            <BaseText variant="body" color="muted" style={{ lineHeight: 1.625 }}>{message}</BaseText>
        </BaseModal>
    );
};
