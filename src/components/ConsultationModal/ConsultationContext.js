import { createContext, useContext } from "react";

/** Спеціальне посилання, яке відкриває попап консультації замість переходу */
export const CONSULTATION_HREF = "#consultation";

export const ConsultationContext = createContext({
  open: () => {},
  isOpen: false,
});

/** const { open } = useConsultation(); open("hero") */
export const useConsultation = () => useContext(ConsultationContext);
