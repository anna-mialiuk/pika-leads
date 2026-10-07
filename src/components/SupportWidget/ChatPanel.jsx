import { useEffect, useRef, useState } from "react";

import CallbackForm from "./CallbackForm";
import logoMark from "../../assets/images/brand/logo-mark.svg";
import { CloseIcon, SendIcon } from "./icons";

import { useLanguage } from "../../i18n";
import { useConsultation } from "../ConsultationModal/ConsultationContext";

const TYPING_DELAY = 900;

/**
 * Чат підтримки з простим сценарієм бота.
 * Повідомлення поки не відправляються на сервер — див. TODO в sendLead.
 */
function ChatPanel({ id, onClose, messages, setMessages, onLead }) {
  const { t } = useLanguage();
  const { open: openConsultation } = useConsultation();

  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Фокус у поле лише на десктопі — на телефоні не відкриваємо клавіатуру одразу
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isTyping]);

  const botReply = (reply) => {
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { from: "bot", ...reply }]);
      if (reply.action === "consultation") openConsultation("chat");
    }, TYPING_DELAY);
  };

  const addUserMessage = (value) =>
    setMessages((prev) => [...prev, { from: "user", text: value }]);

  const handleQuickReply = (type) => {
    addUserMessage(t(`chat.quick.${type}`));

    if (type === "price") botReply({ key: "chat.bot.price", cta: true });
    if (type === "consultation")
      botReply({ key: "chat.bot.consultation", action: "consultation" });
    if (type === "call") botReply({ key: "chat.bot.call", form: true });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;

    addUserMessage(value);
    setText("");
    onLead({ type: "chat-message", message: value });
    botReply({ key: "chat.bot.message", form: true });
  };

  const handlePhone = (index, phone) => {
    setMessages((prev) =>
      prev.map((message, i) =>
        i === index ? { ...message, form: false } : message,
      ),
    );
    addUserMessage(phone);
    onLead({ type: "chat-callback", phone });
    botReply({ key: "chat.bot.thanks" });
  };

  const hasUserMessages = messages.some(({ from }) => from === "user");

  return (
    <div
      className="chat-panel"
      id={id}
      role="dialog"
      aria-label={t("chat.title")}
    >
      <header className="chat-panel__header">
        <span className="chat-panel__avatar" aria-hidden="true">
          <img src={logoMark} alt="" width="26" height="26" />
        </span>

        <div className="chat-panel__heading">
          <strong>{t("chat.title")}</strong>
          <span>{t("chat.status")}</span>
        </div>

        <button
          className="chat-panel__close"
          type="button"
          onClick={onClose}
          aria-label={t("consultation.close")}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="chat-panel__messages" ref={listRef} aria-live="polite">
        {messages.map((message, index) => (
          <div
            className={`chat-panel__message chat-panel__message--${message.from}`}
            key={index}
          >
            <p>{message.key ? t(message.key) : message.text}</p>

            {message.cta && (
              <button
                className="chat-panel__cta"
                type="button"
                onClick={() => openConsultation("chat")}
              >
                {t("common.getConsultation")}
              </button>
            )}

            {message.form && (
              <CallbackForm
                className="chat-panel__form"
                submitText={t("chat.send")}
                onSubmit={(phone) => handlePhone(index, phone)}
              />
            )}
          </div>
        ))}

        {isTyping && (
          <div
            className="chat-panel__message chat-panel__message--bot chat-panel__typing"
            aria-label={t("chat.typing")}
          >
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {!hasUserMessages && (
        <div className="chat-panel__quick">
          {["price", "consultation", "call"].map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => handleQuickReply(type)}
            >
              {t(`chat.quick.${type}`)}
            </button>
          ))}
        </div>
      )}

      <form className="chat-panel__input" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
        />

        <button
          type="submit"
          aria-label={t("chat.send")}
          disabled={!text.trim()}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

export default ChatPanel;
