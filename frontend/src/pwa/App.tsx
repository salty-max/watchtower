import { useEffect, useState } from "react";
import { DataContext, SummaryProvider, type OwnerData } from "../shared/data";
import { navFor } from "../shared/nav";
import { PAGES } from "../shared/pages";
import { ShellProvider, type Cap, type Shell } from "../shared/shell";
import { Chrome } from "./Chrome";

/** The page named in the address's hash (`#/downloads`), Overview when there is none or it is not one of ours. */
export const pageOf = (hash: string, can: ReadonlySet<Cap>) => {
  const id = hash.replace(/^#\/?/, "");
  return navFor(can).some((n) => n.id === id) ? id : "overview";
};

export function App({ shell, data }: { shell: Shell; data: OwnerData }) {
  const [page, setPage] = useState(() => pageOf(location.hash, shell.can));
  useEffect(() => {
    const on = () => {
      setPage(pageOf(location.hash, shell.can));
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const Page = PAGES[page];
  return (
    <ShellProvider shell={{ ...shell, go: (id) => (location.hash = `#/${id}`) }}>
      <DataContext.Provider value={data}>
        <SummaryProvider>
          <Chrome page={page}>
            <Page />
          </Chrome>
        </SummaryProvider>
      </DataContext.Provider>
    </ShellProvider>
  );
}
