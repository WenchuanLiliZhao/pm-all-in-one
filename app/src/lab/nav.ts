export type LabNavItem = {
  id: string;
  label: string;
  path: string;
};

export type LabNavCategory = {
  id: string;
  label: string;
  items: LabNavItem[];
};

/** Sidebar SoT — one route per real component (or foundations token page). */
export const LAB_NAV: LabNavCategory[] = [
  {
    id: "foundations",
    label: "Foundations",
    items: [
      { id: "tokens", label: "Tokens", path: "tokens" },
      { id: "page-width", label: "Page width", path: "page-width" },
    ],
  },
  {
    id: "primitives",
    label: "Primitives",
    items: [
      { id: "button", label: "Button", path: "button" },
      { id: "dropdown-menu", label: "Dropdown menu", path: "dropdown-menu" },
      { id: "toggle-switch", label: "Toggle switch", path: "toggle-switch" },
      { id: "tree-row", label: "Tree row", path: "tree-row" },
      { id: "input", label: "Input", path: "input" },
      { id: "select", label: "Select", path: "select" },
      { id: "textarea", label: "Textarea", path: "textarea" },
      { id: "banner", label: "Banner", path: "banner" },
    ],
  },
  {
    id: "modules",
    label: "Modules",
    items: [
      {
        id: "markdown-editor",
        label: "Markdown editor",
        path: "markdown-editor",
      },
      {
        id: "git-sync-panel",
        label: "Git sync panel",
        path: "git-sync-panel",
      },
    ],
  },
];
