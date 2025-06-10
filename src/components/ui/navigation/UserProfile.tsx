"use client"

import { Button } from "@/components/Button"
import { useSession } from "@/lib/auth-client"
import { cx, focusRing } from "@/lib/utils"
import { useStore } from "@nanostores/react"
import { ChevronsUpDown, User } from "lucide-react"

import { DropdownUserProfile } from "./DropdownUserProfile"

interface UserProfileDesktopProps {
  isCollapsed?: boolean
}

export const UserProfileDesktop = ({ isCollapsed }: UserProfileDesktopProps) => {
  const session = useStore(useSession)
  const user = session?.data?.user
  // Compute initials
  let initials = "";
  let name = user?.name || "";
  if (user?.name) {
    const parts = user.name.trim().split(" ");
    if (parts.length >= 2) {
      initials = `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    } else if (parts.length === 1) {
      initials = parts[0].slice(0, 2).toUpperCase();
    }
  } else if (user?.email) {
    initials = user.email.slice(0, 2).toUpperCase();
  }
  if (!initials) initials = "?";
  return (
    <DropdownUserProfile>
      <Button
        aria-label="User settings"
        variant="ghost"
        className={cx(
          isCollapsed ? "justify-center" : "justify-between",
          focusRing,
          "group flex w-full items-center rounded-md px-1 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200/50 data-[state=open]:bg-gray-200/50 hover:dark:bg-gray-800/50 data-[state=open]:dark:bg-gray-900",
        )}
      >
        {isCollapsed ? (
          <div className="flex h-8 items-center">
            <User
              className="size-5 shrink-0 text-gray-500 group-hover:text-gray-700 dark:text-gray-500 group-hover:dark:text-gray-300"
              aria-hidden="true"
            />
          </div>
        ) : (
          <span className="flex items-center gap-3">
            <span
              className={cx(
                isCollapsed ? "size-5" : "size-8",
                "flex shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300",
              )}
              aria-hidden="true"
            >
              {initials}
            </span>
            <span className={cx(isCollapsed ? "hidden" : "block")}>{name}</span>
          </span>
        )}
        {!isCollapsed && (
          <ChevronsUpDown
            className="size-4 shrink-0 text-gray-500 group-hover:text-gray-700 group-hover:dark:text-gray-400"
            aria-hidden="true"
          />
        )}
      </Button>
    </DropdownUserProfile>
  )
}

export const UserProfileMobile = () => {
  const session = useStore(useSession)
  const user = session?.data?.user
  // Compute initials
  let initials = "";
  if (user?.name) {
    const parts = user.name.trim().split(" ");
    if (parts.length >= 2) {
      initials = `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    } else if (parts.length === 1) {
      initials = parts[0].slice(0, 2).toUpperCase();
    }
  } else if (user?.email) {
    initials = user.email.slice(0, 2).toUpperCase();
  }
  if (!initials) initials = "?";
  return (
    <DropdownUserProfile align="end">
      <Button
        aria-label="User settings"
        variant="ghost"
        className={cx(
          "group flex items-center rounded-md p-0.5 sm:p-1 text-sm font-medium text-gray-900 hover:bg-gray-200/50 data-[state=open]:bg-gray-200/50 hover:dark:bg-gray-800/50 data-[state=open]:dark:bg-gray-800/50",
        )}
      >
        <span
          className="flex size-8 sm:size-7 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
          aria-hidden="true"
        >
          {initials}
        </span>
      </Button>
    </DropdownUserProfile>
  )
}
