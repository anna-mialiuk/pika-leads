import { useCallback, useEffect, useState } from "react";

import ChatPanel from "./ChatPanel";
import CallbackPopup from "./CallbackPopup";
import { ChatIcon, CloseIcon } from "./icons";

import { useLanguage } from "../../i18n";
import { sendLead } from "../../services/leads";
import { useConsultation } from "../ConsultationModal/ConsultationContext";

import "./SupportWidget.sass";

/** Через скільки мілісекунд показати «Передзвонити вам?» */
const CALLBACK_DELAY = 8000;
const CALLBACK_STORAGE_KEY = "pika-callback-popup";

// У режимі розробки (npm run dev) попап показується після кожного
// перезавантаження — щоб було зручно перевіряти. На продакшені — раз за сесію.
const storage = {
  get: () => {
    if (import.meta.env.DEV) return null;

    try {
      return sessionStorage.getItem(CALLBACK_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set: (value) => {
    try {
      sessionStorage.setItem(CALLBACK_STORAGE_KEY, value);
    } catch {
      /* приватний режим — просто не запам'ятовуємо */
    }
  },
};

/** Кнопка чату + панель чату + попап зворотного дзвінка */
function SupportWidget() {
  const { t } = useLanguage();
  const { isOpen: isConsultationOpen } = useConsultation();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [messages, setMessages] = useState([
    { from: "bot", key: "chat.bot.greeting" },
  ]);
  const [callback, setCallback] = useState("hidden"); // hidden | visible | sent

  // Попап з'являється один раз за сесію, якщо людина ще не взаємодіяла з чатом
  useEffect(() => {
    if (storage.get()) return undefined;

    const timer = setTimeout(() => {
      setCallback((state) => (state === "hidden" ? "visible" : state));
    }, CALLBACK_DELAY);

    return () => clearTimeout(timer);
  }, []);

  const closeCallback = useCallback(() => {
    setCallback("hidden");
    storage.set("closed");
  }, []);

  const handleCallbackSubmit = (phone) => {
    sendLead({
      type: "callback",
      source: "callback-popup",
      data: { phone_full: phone },
    }).catch(console.error);
    setCallback("sent");
    storage.set("sent");
    setTimeout(() => setCallback("hidden"), 4000);
  };

  const handleChatLead = ({ type, ...data }) =>
    sendLead({ type, source: "chat", data }).catch(console.error);

  const toggleChat = () => {
    setIsChatOpen((open) => !open);
    setHasUnread(false);
    if (callback === "visible") closeCallback();
  };

  const showCallback =
    callback !== "hidden" && !isChatOpen && !isConsultationOpen;

  return (
    <div className="support-widget">
      {isChatOpen && (
        <ChatPanel
          id="support-chat"
          onClose={() => setIsChatOpen(false)}
          messages={messages}
          setMessages={setMessages}
          onLead={handleChatLead}
        />
      )}

      {showCallback && (
        <CallbackPopup
          isSent={callback === "sent"}
          onSubmit={handleCallbackSubmit}
          onClose={closeCallback}
        />
      )}

      <button
        className={`support-widget__fab ${isChatOpen ? "support-widget__fab--open" : ""}`}
        type="button"
        onClick={toggleChat}
        aria-expanded={isChatOpen}
        aria-controls="support-chat"
        aria-label={isChatOpen ? t("consultation.close") : t("chat.open")}
      >
        {isChatOpen ? <CloseIcon /> : <ChatIcon />}

        {hasUnread && !isChatOpen && (
          <span className="support-widget__badge" aria-hidden="true">
            1
          </span>
        )}
      </button>
    </div>
  );
}

export default SupportWidget;
