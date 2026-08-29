import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { AppLayout } from "@/components/app-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/contexts/auth-context"
import { queryClient } from "@/lib/query-client"
import LoginPage from "@/pages/login"
import NotFoundPage from "@/pages/not-found"
import ProjectPage from "@/pages/project"
import ProjectsPage from "@/pages/projects"
import RegisterPage from "@/pages/register"

export default function App() {
  return (
    // `attribute="class"` matches the `&:is(.dark *)` custom variant in
    // index.css; next-themes puts the class on <html>.
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {/* AuthProvider sits inside the router so its children can navigate,
              and inside the query client so logout can clear the cache. */}
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                <Route element={<ProtectedRoute />}>
                  {/* AppLayout nests inside the guard so the shell only ever
                      renders for a known user, and survives navigation between
                      projects without remounting. */}
                  <Route element={<AppLayout />}>
                    <Route index element={<Navigate to="/projects" replace />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:id" element={<ProjectPage />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
          <Toaster richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
