import type { PageProps } from "../../types";
import { Content } from "./content";

export const WelcomePage: PageProps = {
  params: {
    title: "Welcome",
    slug: "welcome",
    description: "Create or open a workspace folder.",
  },
  content: <Content />,
};
