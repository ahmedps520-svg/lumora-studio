"use client";

/**
 * One description of a menu, rendered as a right-click menu or a dropdown —
 * so the "…" button and right-click always offer the same commands.
 */
import type { LucideIcon } from "lucide-react";
import { Fragment } from "react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

export interface MenuItemSpec {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Draw a divider above this item. */
  separator?: boolean;
  /** Nested items (a submenu). */
  items?: MenuItemSpec[];
}

/** Drops hidden items and leading/doubled separators. */
const visible = (items: (MenuItemSpec | false | null | undefined)[]) =>
  items.filter((i): i is MenuItemSpec => Boolean(i));

export function ContextItems({ items }: { items: (MenuItemSpec | false | null | undefined)[] }) {
  return visible(items).map((item, index) => (
    <Fragment key={item.id}>
      {item.separator && index > 0 && <ContextMenuSeparator />}
      {item.items ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={item.disabled}>
            {item.icon && <item.icon />}
            {item.label}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextItems items={item.items} />
          </ContextMenuSubContent>
        </ContextMenuSub>
      ) : (
        <ContextMenuItem
          disabled={item.disabled}
          variant={item.destructive ? "destructive" : "default"}
          onSelect={item.onSelect}
          data-testid={`menu-${item.id}`}
        >
          {item.icon && <item.icon />}
          {item.label}
          {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
        </ContextMenuItem>
      )}
    </Fragment>
  ));
}

export function DropdownItems({ items }: { items: (MenuItemSpec | false | null | undefined)[] }) {
  return visible(items).map((item, index) => (
    <Fragment key={item.id}>
      {item.separator && index > 0 && <DropdownMenuSeparator />}
      {item.items ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={item.disabled}>
            {item.icon && <item.icon />}
            {item.label}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownItems items={item.items} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : (
        <DropdownMenuItem
          disabled={item.disabled}
          variant={item.destructive ? "destructive" : "default"}
          onSelect={item.onSelect}
        >
          {item.icon && <item.icon />}
          {item.label}
          {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
        </DropdownMenuItem>
      )}
    </Fragment>
  ));
}
