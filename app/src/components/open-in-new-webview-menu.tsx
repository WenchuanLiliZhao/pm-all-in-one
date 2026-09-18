import type { MouseEvent, ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { getPm, isVsCodePm } from "@/lib/bridge";
import { openPmDocument } from "@/lib/bridge/open-pm-document";
import type { NodeRef } from "@/lib/bridge/pm-api";

type OpenInNewWebviewContextValue = {
  onNodeContextMenu: (event: MouseEvent, ref: NodeRef) => void;
};

const OpenInNewWebviewContext = createContext<OpenInNewWebviewContextValue>({
  onNodeContextMenu: () => undefined,
});

export function OpenInNewWebviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    ref: NodeRef;
  } | null>(null);

  const onNodeContextMenu = useCallback((event: MouseEvent, ref: NodeRef) => {
    if (!isVsCodePm() || !getPm().openPmNode) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, ref });
  }, []);

  return (
    <OpenInNewWebviewContext.Provider value={{ onNodeContextMenu }}>
      {children}
      {isVsCodePm() ? (
        <DropdownMenu
          open={menu != null}
          onOpenChange={(open) => {
            if (!open) {
              setMenu(null);
            }
          }}
        >
          {menu ? (
            <DropdownMenu.Content
              anchorPoint={{ x: menu.x, y: menu.y }}
              side="bottom"
              align="start"
            >
              <DropdownMenu.ItemButton
                label="Open in new webview"
                onSelect={() => {
                  const ref = menu.ref;
                  setMenu(null);
                  void openPmDocument(ref);
                }}
              />
            </DropdownMenu.Content>
          ) : null}
        </DropdownMenu>
      ) : null}
    </OpenInNewWebviewContext.Provider>
  );
}

export function useOpenInNewWebview(): OpenInNewWebviewContextValue {
  return useContext(OpenInNewWebviewContext);
}
