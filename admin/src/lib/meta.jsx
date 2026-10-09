import { createContext, useContext, useEffect, useState } from "react";

import { api } from "./api";
import { t } from "./i18n";

/** Довідники з сервера: статуси, типи заявок, співробітники */
const MetaContext = createContext(null);

export function MetaProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [users, setUsers] = useState([]);

  const loadUsers = () =>
    api("/users")
      .then(({ users: list }) => setUsers(list))
      .catch(() => {});

  useEffect(() => {
    api("/meta").then(setMeta).catch(() => {});
    loadUsers();
  }, []);

  if (!meta) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    );
  }

  // довідники без прототипа: значення з даних («__proto__», «constructor») не знайдуть вбудованих об'єктів
  const dict = (entries) => Object.assign(Object.create(null), Object.fromEntries(entries));
  // підписи з сервера — російською, перекладаємо на мову панелі
  const statuses = meta.statuses.map((s) => ({ ...s, label: t(s.label) }));
  const statusByCode = dict(statuses.map((s) => [s.code, s]));
  const userById = dict(users.map((u) => [u.id, u]));
  const types = dict(Object.entries(meta.types).map(([code, label]) => [code, t(label)]));

  return (
    <MetaContext.Provider value={{ ...meta, statuses, types, statusByCode, users, userById, reloadUsers: loadUsers }}>
      {children}
    </MetaContext.Provider>
  );
}

export const useMeta = () => useContext(MetaContext);
