import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { trackPageView } from "../../services/tracking";

/** Перегляд сторінки в Meta Pixel при переходах усередині сайту (GA4 рахує сам) */
function RouteTracker() {
  const { pathname } = useLocation();
  useEffect(() => trackPageView(pathname), [pathname]);
  return null;
}

export default RouteTracker;
