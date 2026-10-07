import { Link, Navigate } from "react-router-dom";

import { useLanguage } from "./useLanguage";

/** Link з react-router, який автоматично додає мовний префікс */
function LocalizedLink({ to, ...props }) {
  const { link } = useLanguage();

  return <Link to={link(to)} {...props} />;
}

/** Navigate з мовним префіксом */
export function LocalizedNavigate({ to, ...props }) {
  const { link } = useLanguage();

  return <Navigate to={link(to)} {...props} />;
}

export default LocalizedLink;
