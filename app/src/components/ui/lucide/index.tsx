/**
 * Local Lucide namespace — named re-exports only (tree-shake friendly).
 * Inside Button startIcon/endIcon: omit size/strokeWidth; CSS sets 1em + --icon-stroke-width.
 * Standalone: defaults strokeWidth to 1.5 (token); size still Lucide default unless passed.
 */
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Circle,
  CircleCheckBig,
  CircleDashed,
  CircleDot,
  CircleOff,
  Copy,
  Equal,
  Ellipsis,
  FileText,
  Folder,
  FolderOpen,
  Home,
  Inbox,
  Layers,
  LoaderCircle,
  Music,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Settings,
  Star,
  Trash2,
  Users,
  X,
  type LucideProps,
} from "lucide-react";
import type { ComponentType, ReactElement } from "react";

const DEFAULT_STROKE = 1.5;

function withIconDefaults(
  Icon: ComponentType<LucideProps>,
  displayName: string,
): (props: LucideProps) => ReactElement {
  function Wrapped({ strokeWidth = DEFAULT_STROKE, ...rest }: LucideProps) {
    return <Icon strokeWidth={strokeWidth} {...rest} />;
  }
  Wrapped.displayName = `Lucide.${displayName}`;
  return Wrapped;
}

export const Lucide = {
  Archive: withIconDefaults(Archive, "Archive"),
  ChevronDown: withIconDefaults(ChevronDown, "ChevronDown"),
  ChevronLeft: withIconDefaults(ChevronLeft, "ChevronLeft"),
  ChevronRight: withIconDefaults(ChevronRight, "ChevronRight"),
  ChevronsDown: withIconDefaults(ChevronsDown, "ChevronsDown"),
  ChevronsUp: withIconDefaults(ChevronsUp, "ChevronsUp"),
  ChevronUp: withIconDefaults(ChevronUp, "ChevronUp"),
  Circle: withIconDefaults(Circle, "Circle"),
  CircleCheckBig: withIconDefaults(CircleCheckBig, "CircleCheckBig"),
  CircleDashed: withIconDefaults(CircleDashed, "CircleDashed"),
  CircleDot: withIconDefaults(CircleDot, "CircleDot"),
  CircleOff: withIconDefaults(CircleOff, "CircleOff"),
  Copy: withIconDefaults(Copy, "Copy"),
  Equal: withIconDefaults(Equal, "Equal"),
  Ellipsis: withIconDefaults(Ellipsis, "Ellipsis"),
  FileText: withIconDefaults(FileText, "FileText"),
  Folder: withIconDefaults(Folder, "Folder"),
  FolderOpen: withIconDefaults(FolderOpen, "FolderOpen"),
  Home: withIconDefaults(Home, "Home"),
  Inbox: withIconDefaults(Inbox, "Inbox"),
  Layers: withIconDefaults(Layers, "Layers"),
  LoaderCircle: withIconDefaults(LoaderCircle, "LoaderCircle"),
  Music: withIconDefaults(Music, "Music"),
  Plus: withIconDefaults(Plus, "Plus"),
  RefreshCw: withIconDefaults(RefreshCw, "RefreshCw"),
  Save: withIconDefaults(Save, "Save"),
  Scissors: withIconDefaults(Scissors, "Scissors"),
  Settings: withIconDefaults(Settings, "Settings"),
  Star: withIconDefaults(Star, "Star"),
  Trash2: withIconDefaults(Trash2, "Trash2"),
  Users: withIconDefaults(Users, "Users"),
  X: withIconDefaults(X, "X"),
} as const;

export type { LucideProps };
