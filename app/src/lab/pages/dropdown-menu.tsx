/**
 * Lab matrix for DropdownMenu — real module `@/components/ui/dropdown-menu`.
 *
 * ↔ components/ui/dropdown-menu — component under test
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageWidth } from "@/components/ui/page-width";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Lucide } from "@/components/ui/lucide";
import styles from "./page.module.scss";

export function DropdownMenuPage() {
  const [lastAction, setLastAction] = useState<string>("—");
  const [activeId, setActiveId] = useState("inbox");
  const [notifications, setNotifications] = useState(true);

  const note = (label: string) => {
    setLastAction(label);
  };

  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Dropdown menu</h1>
      <p className={styles.lead}>
        Real component: <code>@/components/ui/dropdown-menu</code>. Product
        (e.g. <code>MemberPersonSelect</code>) and lab share this module.
        Compound API: Trigger, Content, Item, ItemButton, ItemWithShortcut,
        ItemWithSwitch, Group, Label, Separator, optional <code>filter</code>.
      </p>
      <p className={styles.blockLabel}>Last action: {lastAction}</p>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Item + Trigger asChild (Button)</p>
        <div className={styles.row}>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="outlined" endIcon={<Lucide.ChevronDown />}>
                Open
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" side="bottom">
              <DropdownMenu.Item onSelect={() => note("Custom item A")}>
                Custom item A
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => note("Custom item B")}>
                Custom item B
              </DropdownMenu.Item>
              <DropdownMenu.Item disabled onSelect={() => note("disabled")}>
                Disabled item
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>ItemButton (icon / active / disabled)</p>
        <div className={styles.row}>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="outlined" endIcon={<Lucide.ChevronDown />}>
                Views
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" side="bottom">
              <DropdownMenu.ItemButton
                label="Inbox"
                icon={<Lucide.Inbox />}
                active={activeId === "inbox"}
                onSelect={() => {
                  setActiveId("inbox");
                  note("Inbox");
                }}
              />
              <DropdownMenu.ItemButton
                label="Starred"
                icon={<Lucide.Star />}
                active={activeId === "starred"}
                onSelect={() => {
                  setActiveId("starred");
                  note("Starred");
                }}
              />
              <DropdownMenu.ItemButton
                label="Archive"
                icon={<Lucide.Archive />}
                disabled
              />
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Group + Label + Separator</p>
        <div className={styles.row}>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="outlined" endIcon={<Lucide.ChevronDown />}>
                Grouped
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" side="bottom">
              <DropdownMenu.Label>Actions</DropdownMenu.Label>
              <DropdownMenu.Group>
                <DropdownMenu.ItemButton
                  label="Duplicate"
                  onSelect={() => note("Duplicate")}
                />
                <DropdownMenu.ItemButton
                  label="Rename"
                  onSelect={() => note("Rename")}
                />
              </DropdownMenu.Group>
              <DropdownMenu.Separator />
              <DropdownMenu.Label>Danger</DropdownMenu.Label>
              <DropdownMenu.ItemButton
                label="Delete"
                onSelect={() => note("Delete")}
              />
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>ItemWithShortcut</p>
        <div className={styles.row}>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="outlined" endIcon={<Lucide.ChevronDown />}>
                Edit
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" side="bottom">
              <DropdownMenu.ItemWithShortcut
                label="Cut"
                shortcut="⌘X"
                icon={<Lucide.Scissors />}
                onSelect={() => note("Cut")}
              />
              <DropdownMenu.ItemWithShortcut
                label="Copy"
                shortcut="⌘C"
                icon={<Lucide.Copy />}
                onSelect={() => note("Copy")}
              />
              <DropdownMenu.ItemWithShortcut
                label="Paste"
                shortcut="⌘V"
                disabled
              />
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>ItemWithSwitch (stays open)</p>
        <div className={styles.row}>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="outlined" endIcon={<Lucide.ChevronDown />}>
                Preferences
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" side="bottom">
              <DropdownMenu.ItemWithSwitch
                label="Notifications"
                checked={notifications}
                onCheckedChange={(v) => {
                  setNotifications(v);
                  note(`Notifications ${v ? "on" : "off"}`);
                }}
              />
              <DropdownMenu.ItemButton
                label="Account settings…"
                onSelect={() => note("Account settings")}
              />
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>filter (type to narrow ItemButtons)</p>
        <div className={styles.row}>
          <DropdownMenu filter={{ placeholder: "Filter fruits…" }}>
            <DropdownMenu.Trigger asChild>
              <Button variant="outlined" endIcon={<Lucide.ChevronDown />}>
                Filterable
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" side="bottom">
              <DropdownMenu.Label>Fruits</DropdownMenu.Label>
              {["Apple", "Banana", "Cherry", "Date", "Elderberry"].map(
                (fruit) => (
                  <DropdownMenu.ItemButton
                    key={fruit}
                    label={fruit}
                    onSelect={() => note(fruit)}
                  />
                ),
              )}
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>
    </PageWidth>
  );
}
