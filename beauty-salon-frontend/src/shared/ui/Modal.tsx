// src/components/UI/Modal.tsx

import React, { type ReactElement } from 'react';
import '@/styles/components/Modal.css';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }): ReactElement | null => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="modal-content"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                style={{
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button
                        onClick={onClose}
                        className="modal-close-btn"
                        type="button"
                    >
                        &times;
                    </button>
                </div>

                <div style={{
                    overflowY: 'auto',
                    flex: 1,
                    padding: '0 5px'
                }}>
                    {children}
                </div>
            </div>
        </div>
    );
};