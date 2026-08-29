import type { ReactNode } from "react"
import { Link } from "react-router"
import { SquareCheckBigIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
  /** Cross-link rendered under the card, outside its visual weight. */
  footer?: ReactNode
}

/**
 * Shell shared by sign-in and sign-up: wordmark, one centered card, and a
 * quiet page ground. The card is `bg-card` (white in light, a step lighter
 * than the page in dark) so it lifts off the background without a border
 * treatment or any decoration.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12 dark:bg-background">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 flex items-center justify-center gap-2 rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <SquareCheckBigIcon className="size-5" aria-hidden="true" />
          <span className="font-heading text-lg font-medium tracking-tight">
            TaskFlow
          </span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        {footer !== undefined && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        )}
      </div>
    </div>
  )
}
