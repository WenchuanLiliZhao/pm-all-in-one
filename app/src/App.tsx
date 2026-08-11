import { useEffect } from "react";
import { createHashRouter, Navigate, Outlet } from "react-router-dom";
import { ElectronShell } from "@/layout/electron-shell";
import { getPm, isWebPm } from "@/lib/bridge";
import { ToastProvider } from "@/lib/toast";
import { WorkspaceProvider } from "@/lib/workspace/workspace-context";
import { LabLayout } from "@/lab/layout";
import { BannerPage } from "@/lab/pages/banner";
import { ButtonPage } from "@/lab/pages/button";
import { DropdownMenuPage } from "@/lab/pages/dropdown-menu";
import { InputPage } from "@/lab/pages/input";
import { MarkdownEditorPage } from "@/lab/pages/markdown-editor";
import { PageWidthPage } from "@/lab/pages/page-width";
import { SelectPage } from "@/lab/pages/select";
import { TextareaPage } from "@/lab/pages/textarea";
import { ToggleSwitchPage } from "@/lab/pages/toggle-switch";
import { TokensPage } from "@/lab/pages/tokens";
import { TreeRowPage } from "@/lab/pages/tree-row";
import { Pages } from "@/pages";
import {
  CustomViewPage,
  WikiAllPagesView,
  WikiNodeView,
  MembersAllPagesView,
  MemberDetailView,
  CollaborationView,
  HandoffDetailView,
  HomeView,
  ProjectSettingsView,
  RoadmapView,
  SettingsGeneralView,
  TableView,
  WorkspaceLayout,
} from "@/pages/channels/workspace-page";

function useWebUiLabHotkey(): void {
  useEffect(() => {
    if (!import.meta.env.DEV || !isWebPm()) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "d"
      ) {
        event.preventDefault();
        void getPm().openUiLab();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function AppChrome() {
  useWebUiLabHotkey();
  return (
    <ToastProvider>
      <WorkspaceProvider>
        <ElectronShell>
          <Outlet />
        </ElectronShell>
      </WorkspaceProvider>
    </ToastProvider>
  );
}

export const router = createHashRouter([
  {
    element: <AppChrome />,
    children: [
      {
        index: true,
        element: Pages.WelcomePage.content,
      },
      {
        path: "w",
        element: <WorkspaceLayout />,
        children: [
          { index: true, element: <Navigate to="home" replace /> },
          { path: "home", element: <HomeView /> },
          { path: "wiki", element: <WikiAllPagesView /> },
          { path: "wiki/:wikiNodeId", element: <WikiNodeView /> },
          { path: "members", element: <MembersAllPagesView /> },
          { path: "members/:memberId", element: <MemberDetailView /> },
          { path: "handoffs", element: <CollaborationView /> },
          { path: "handoffs/:handoffId", element: <HandoffDetailView /> },
          { path: "settings/general", element: <SettingsGeneralView /> },
          {
            path: "projects/:projectId/settings",
            element: <ProjectSettingsView />,
          },
          { path: "roadmap", element: <RoadmapView /> },
          { path: "table", element: <TableView /> },
          { path: "views/:viewId", element: <CustomViewPage /> },
        ],
      },
      {
        path: "workspace",
        element: <Navigate to="/w/home" replace />,
      },
      {
        path: "schema",
        element: <Navigate to="/w/home" replace />,
      },
      ...(import.meta.env.DEV
        ? [
            {
              path: "lab",
              element: <LabLayout />,
              children: [
                { index: true, element: <Navigate to="tokens" replace /> },
                { path: "tokens", element: <TokensPage /> },
                { path: "page-width", element: <PageWidthPage /> },
                { path: "button", element: <ButtonPage /> },
                { path: "dropdown-menu", element: <DropdownMenuPage /> },
                { path: "toggle-switch", element: <ToggleSwitchPage /> },
                { path: "tree-row", element: <TreeRowPage /> },
                { path: "input", element: <InputPage /> },
                { path: "select", element: <SelectPage /> },
                { path: "textarea", element: <TextareaPage /> },
                { path: "banner", element: <BannerPage /> },
                { path: "markdown-editor", element: <MarkdownEditorPage /> },
              ],
            },
          ]
        : []),
      {
        path: "*",
        element: Pages.NotFoundPage.content,
      },
    ],
  },
]);
