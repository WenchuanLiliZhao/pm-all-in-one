import type { PageProps } from "../../types";
import { Content } from "./content";

export const NotFoundPage: PageProps = {
  params: {
    title: "Not found",
    slug: "not-found",
    description: "Unknown route.",
  },
  content: <Content />,
};
