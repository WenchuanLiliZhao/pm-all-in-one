import type { PageProps } from "./types";
import { ChannelPages } from "./channels";

export const Pages = {
  ...ChannelPages,
} satisfies Record<string, PageProps>;

export type { PageProps } from "./types";
