import React, { useEffect, useRef } from 'react';
import './Modal.css';

/**
 * Props for the Modal component.
 */
export interface ModalProps {
  /**
   * Toggles the visibility of the modal dialog.
   */
  isOpen: boolean;
  /**
   * Callback fired when closing the modal (backdrop click, escape key, or close button).
   */
  onClose: () => void;
  /**
   * Title text or element displayed in the modal header.
   */
  title?: React.ReactNode;
  /**
   * Modal body content.
   */
  children?: React.ReactNode;
  /**
   * Size variant defining the maximum width of the dialog.
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Modal dialog overlay supporting focus trapping, escape-key closing, and accessibility compliance.
 *
 * @example
 * ```tsx
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Confirmation">
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 * ```
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Store currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;
    // Lock scroll
    document.body.style.overflow = 'hidden';

    // Focus the close button or modal container for accessibility
    setTimeout(() => {
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
      } else if (modalContainerRef.current) {
        modalContainerRef.current.focus();
      }
    }, 50);

    // Setup escape key listener
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      // Focus trapping helper: Tab key looping
      if (event.key === 'Tab' && modalContainerRef.current) {
        const focusableElements =
          modalContainerRef.current.querySelectorAll<HTMLElement>(
            'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]',
          );
        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (event.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              event.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              event.preventDefault();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div className="ui-modal-overlay" onClick={onClose}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={modalContainerRef}
        className={`ui-modal ui-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ui-modal-title' : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal-header">
          {title && (
            <h2 id="ui-modal-title" className="ui-modal-title-text">
              {title}
            </h2>
          )}
          <button
            ref={closeButtonRef}
            className="ui-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  );
};
