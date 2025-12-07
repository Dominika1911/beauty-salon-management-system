// src/components/UI/Modal.tsx

import React, { type ReactElement } from 'react';
import './Modal.css'; // 🚨 IMPORTUJEMY NOWE STYLE

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

    // Użycie backdrop, aby zamknąć modal po kliknięciu poza formularzem
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>

                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button
                        onClick={onClose}
                        className="modal-close-btn"
                    >
                        &times;
                    </button>
                </div>

                {children}
            </div>
        </div>
    );
};