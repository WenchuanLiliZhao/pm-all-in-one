import type { ReactNode } from "react";

export interface PageParams {
  slug: string;
  title: string;
  description?: string;
}

export interface PageProps {
  params: PageParams;
  content: ReactNode;
}
