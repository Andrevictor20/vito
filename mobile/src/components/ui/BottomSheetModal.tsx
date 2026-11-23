import React from 'react';
import { VitoSheet } from './VitoSheet';

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

/**
 * BottomSheetModal — wrapper retrocompatível sobre `VitoSheet`.
 *
 * Antes era um cartão centralizado com fade; agora renderiza o bottom sheet canônico
 * do protótipo (`.sheet2`). A API pública (visible/onClose/children/title/subtitle)
 * é preservada, então as ~29 telas que o consomem continuam funcionando sem alteração.
 */
export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  children,
  title,
  subtitle,
}) => (
  <VitoSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
    {children}
  </VitoSheet>
);
