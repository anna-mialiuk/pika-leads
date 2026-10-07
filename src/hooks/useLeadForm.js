import { useCallback, useState } from "react";

import { formToObject, sendLead } from "../services/leads";

/**
 * Стан і відправка форми заявки.
 * const { status, handleSubmit } = useLeadForm("audit");
 * <form onSubmit={handleSubmit}> … ; status: idle | sending | success | error
 */
export function useLeadForm(type, { source = "", extra } = {}) {
  const [status, setStatus] = useState("idle");

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (status === "sending") return;

      setStatus("sending");

      try {
        await sendLead({
          type,
          source,
          data: { ...formToObject(event.currentTarget), ...extra },
        });
        setStatus("success");
      } catch (error) {
        console.error(error);
        setStatus("error");
      }
    },
    [type, source, extra, status],
  );

  return { status, handleSubmit };
}
