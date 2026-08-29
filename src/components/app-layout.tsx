import { useEffect, useState } from "react"
import {
  LogOutIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  PlusIcon,
  SquareCheckBigIcon,
  SunIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Link, Outlet, useMatch, useNavigate } from "react-router"

import { ProjectDialog } from "@/components/project-dialog"
import { ProjectList } from "@/components/project-list"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/auth-context"
import { useProjects } from "@/lib/queries"
import { cn } from "@/lib/utils"

const COLLAPSED_STORAGE_KEY = "taskflow.sidebarCollapsed"

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

/** Shell for every authenticated route: sidebar, top bar, and the outlet. */
export function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsedPreference)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed))
    } catch {
      /* Preference just won't persist. */
    }
  }, [isCollapsed])

  const openCreate = () => {
    setIsCreateOpen(true)
    setIsMobileOpen(false)
  }

  return (
    <div
      className="min-h-svh"
      style={
        {
          "--sidebar-width": isCollapsed ? "4rem" : "16rem",
        } as React.CSSProperties
      }
    >
      {/* Desktop rail. Fixed, so the content column scrolls independently. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-width) border-r bg-sidebar transition-[width] duration-200 md:block">
        <SidebarContent
          collapsed={isCollapsed}
          onToggleCollapse={() => {
            setIsCollapsed((value) => !value)
          }}
          onCreateProject={openCreate}
        />
      </aside>

      {/* Below md the same content lives in a sheet. */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Your projects</SheetDescription>
          </SheetHeader>
          <SidebarContent
            collapsed={false}
            onCreateProject={openCreate}
            onNavigate={() => {
              setIsMobileOpen(false)
            }}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-svh min-w-0 flex-col transition-[padding] duration-200 md:pl-(--sidebar-width)">
        <TopBar
          onOpenMobileNav={() => {
            setIsMobileOpen(true)
          }}
        />
        {/* min-h-0 so a full-height child (the board) can scroll its own
            columns instead of stretching the page. */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>

      <ProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  )
}

interface SidebarContentProps {
  collapsed: boolean
  onCreateProject: () => void
  onToggleCollapse?: () => void
  onNavigate?: () => void
}

function SidebarContent({
  collapsed,
  onCreateProject,
  onToggleCollapse,
  onNavigate,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div
        className={cn(
          "flex h-9 items-center",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        <Link
          to="/projects"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <SquareCheckBigIcon className="size-5 shrink-0" aria-hidden="true" />
          {!collapsed && (
            <span className="font-heading text-base font-medium tracking-tight">
              TaskFlow
            </span>
          )}
        </Link>

        {!collapsed && onToggleCollapse !== undefined && (
          <Button variant="ghost" size="icon-sm" onClick={onToggleCollapse}>
            <PanelLeftIcon />
            <span className="sr-only">Collapse sidebar</span>
          </Button>
        )}
      </div>

      {collapsed && onToggleCollapse !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="self-center"
              onClick={onToggleCollapse}
            >
              <PanelLeftIcon />
              <span className="sr-only">Expand sidebar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Expand sidebar</TooltipContent>
        </Tooltip>
      )}

      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" className="self-center" onClick={onCreateProject}>
              <PlusIcon />
              <span className="sr-only">New project</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New project</TooltipContent>
        </Tooltip>
      ) : (
        <Button size="sm" className="w-full" onClick={onCreateProject}>
          <PlusIcon />
          New project
        </Button>
      )}

      <nav aria-label="Projects" className="min-h-0 flex-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            Projects
          </p>
        )}
        <ProjectList collapsed={collapsed} onNavigate={onNavigate} />
      </nav>
    </div>
  )
}

function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const match = useMatch("/projects/:id")
  const projectId = match?.params.id
  // Read the name off the list the sidebar already loaded rather than firing a
  // second request for one field.
  const { data: projects, isPending } = useProjects()
  const activeProject = projects?.find((project) => project.id === projectId)

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onOpenMobileNav}
      >
        <MenuIcon />
        <span className="sr-only">Open navigation</span>
      </Button>

      {projectId !== undefined && isPending ? (
        // Same height and rough width as the title it becomes.
        <Skeleton className="h-4 w-36 rounded-full" />
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          {activeProject !== undefined && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: activeProject.color }}
              aria-hidden="true"
            />
          )}
          {/* Chrome, not the page heading: each page owns its own <h1>. */}
          <div className="truncate font-heading text-base font-medium">
            {activeProject?.name ?? "Projects"}
          </div>
        </div>
      )}

      <div className="ml-auto">
        <UserMenu />
      </div>
    </header>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const initials = (user?.name ?? user?.email ?? "?").trim().charAt(0).toUpperCase()

  const onSignOut = () => {
    logout()
    void navigate("/login", { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="rounded-full">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="sr-only">Account menu</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          {user?.name !== undefined && user.name.length > 0 && (
            <span className="truncate">{user.name}</span>
          )}
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user?.email}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        {/* `theme` is undefined on the very first render, before next-themes
            has read the stored preference. */}
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <SunIcon />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onSignOut}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
