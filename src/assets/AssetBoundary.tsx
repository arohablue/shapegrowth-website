import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Rendered in place of the children when loading fails. */
  fallback: ReactNode
  onError?: (error: Error) => void
}

interface State {
  error: Error | null
}

/**
 * Catches asset load failures.
 *
 * A missing or malformed reconstruction must never take the page down with it —
 * the reader should still get the scroll experience with the placeholder in the
 * canvas. This has to be a class component: `getDerivedStateFromError` has no
 * hook equivalent, and R3F's reconciler handles class components fine inside
 * the Canvas tree.
 *
 * Note it does not retry. A 404 or a corrupt file will not fix itself, and an
 * automatic retry loop against a large asset is a good way to saturate a
 * connection.
 */
export class AssetBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error)
    console.error('[assets] failed to load reconstruction — falling back to placeholder', error, info)
  }

  render() {
    return this.state.error ? this.props.fallback : this.props.children
  }
}
