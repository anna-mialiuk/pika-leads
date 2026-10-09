import { useCallback, useMemo, useRef, useState } from "react";

import ConsultationModal from "./ConsultationModal";
import { ConsultationContext } from "./ConsultationContext";
import { trackEvent } from "../../services/tracking";

/**
 * Глобальний попап «Отримати консультацію».
 * Будь-яка кнопка з href="#consultation" (або виклик open()) відкриває його.
 */
function ConsultationProvider({ children }) {
  const [state, setState] = useState({ isOpen: false, source: "" });
  const triggerRef = useRef(null);

  const open = useCallback((source = "") => {
    triggerRef.current = document.activeElement;
    setState({ isOpen: true, source });
    trackEvent("form_open", { form_type: "consultation", form_location: source || "page" });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
    // повертаємо фокус на кнопку, з якої відкрили попап
    triggerRef.current?.focus?.();
  }, []);

  const value = useMemo(
    () => ({ open, isOpen: state.isOpen }),
    [open, state.isOpen],
  );

  return (
    <ConsultationContext.Provider value={value}>
      {children}

      {state.isOpen && (
        <ConsultationModal source={state.source} onClose={close} />
      )}
    </ConsultationContext.Provider>
  );
}

export default ConsultationProvider;
