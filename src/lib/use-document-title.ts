import { useEffect } from "react"

const BASE_TITLE = "TaskFlow"

/**
 * Sets `document.title` for the lifetime of the component, restoring whatever
 * was there before on unmount so a route that sets no title of its own does
 * not inherit the previous page's.
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    if (title === undefined) return

    const previous = document.title
    document.title = `${title} · ${BASE_TITLE}`

    return () => {
      document.title = previous
    }
  }, [title])
}
