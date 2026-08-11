import type { PageProps } from "../../types";
import { WorkspaceLayout } from "./route";

export const WorkspacePage: PageProps = {
  params: {
    title: "Workspace",
    slug: "w",
    description: "Views shell with detail sidebar and terminal.",
  },
  content: <WorkspaceLayout />,
};

export {
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
} from "./route";
