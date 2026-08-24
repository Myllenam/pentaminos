"use client";

import type { ReactNode } from "react";

import {
  AlertDialog as UIAlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AlertVariant = "default" | "destructive";

type AlertProps = {
  /** Controla a visibilidade do diálogo. */
  open: boolean;
  /** Chamado quando o estado de abertura muda (ESC, botão cancelar, backdrop). */
  onOpenChange: (open: boolean) => void;
  /** Título do alerta. */
  title: string;
  /** Descrição opcional abaixo do título. */
  description?: ReactNode;
  /** Rótulo do botão de confirmação. Padrão: "Confirmar". */
  confirmLabel?: string;
  /** Rótulo do botão de cancelamento. Padrão: "Cancelar". */
  cancelLabel?: string;
  /**
   * Variante visual do botão primário.
   * - `default`: ação neutra
   * - `destructive`: ação destrutiva (reiniciar, apagar, etc.)
   */
  variant?: AlertVariant;
  /** Callback disparado ao confirmar. Também fecha o diálogo automaticamente. */
  onConfirm: () => void;
  /** Se `false`, esconde o botão de cancelar. Padrão: `true`. */
  showCancel?: boolean;
};

/**
 * Componente de alerta genérico baseado em `AlertDialog` do shadcn/ui.
 * Uso: controle `open` externamente com `useState`, e passe os callbacks.
 */
export const Alert = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  showCancel = true,
}: AlertProps) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <UIAlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {showCancel && <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>}
          <AlertDialogAction variant={variant} onClick={handleConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </UIAlertDialog>
  );
};
