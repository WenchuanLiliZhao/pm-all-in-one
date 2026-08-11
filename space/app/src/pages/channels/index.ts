import type { PageProps } from "../types";
import { NotFoundPage } from "./not-found-page";
import { WelcomePage } from "./welcome-page";
import { WorkspacePage } from "./workspace-page";

export const ChannelPages = {
  WelcomePage,
  WorkspacePage,
  NotFoundPage,
} satisfies Record<string, PageProps>;
