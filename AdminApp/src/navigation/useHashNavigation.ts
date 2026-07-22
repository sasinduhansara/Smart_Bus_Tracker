import { useCallback, useEffect, useState } from "react";

import { NAV_ITEMS } from "./navItems";
import type { Page } from "../types";

function getPageFromHash(): Page {
  const hashValue = window.location.hash.replace("#", "") as Page;

  return NAV_ITEMS.some((item) => item.id === hashValue)
    ? hashValue
    : "overview";
}

export function useHashNavigation() {
  const [page, setPage] = useState<Page>(getPageFromHash);

  useEffect(() => {
    const handleHashChange = () => {
      setPage(getPageFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const navigate = useCallback((nextPage: Page) => {
    setPage(nextPage);
    window.location.hash = nextPage;
  }, []);

  return { page, navigate };
}
