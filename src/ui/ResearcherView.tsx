import { lazy, Suspense, useEffect, useRef } from 'react'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE GROWTH FIELDS AT FULL SIZE, FOR SOMEONE READING THE DATA RATHER THAN
 * THE PAGE
 * ────────────────────────────────────────────────────────────────────────────
 * On the page the growth plate is capped by `.offering__stage-box` at
 * `(78vh - 6rem) * --stage-aspect`, because it is one figure inside a reading
 * sequence and a figure that fills the viewport stops being an illustration of
 * the paragraph beside it. That cap is right for a reader and wrong for anyone
 * trying to follow an individual displacement vector through a 3,000-point
 * cloud. This is the escape hatch, and it is off unless asked for by name.
 *
 *
 * WHY THERE IS ALMOST NOTHING HERE
 * ────────────────────────────────
 * `GrowthFieldView` takes `{ active, beat }` and nothing else. At
 * `beat="explore"` it already builds the whole apparatus — the specimen select,
 * the five modes, the density and vector-scale pickers, Reset, the pointer
 * orbit, the keyboard orbit and ctrl+wheel zoom. Its root is `width: 100%;
 * height: 100%` and the canvas fills that, so its size is entirely its
 * parent's.
 *
 * So "a bigger version of the 3D view" is not a second view. It is the same
 * one in a bigger box, and this file is the box.
 *
 *
 * WHY `<dialog>`, AND WHY THE CHILDREN ARE CONDITIONAL
 * ───────────────────────────────────────────────────
 * Both answers are `Figure.tsx`'s `ExpandedView`, which solved this already and
 * whose header carries the full argument. In short: `showModal()` gives the
 * focus trap, the inert background, Escape, and focus restore, correctly and
 * for free, where the hand-rolled version is fifty lines that are subtly wrong
 * on some browser.
 *
 * And the children render only while open because the child is a WebGL view —
 * mounting one inside a closed dialog would hold a GL context open for the life
 * of the page. The `<dialog>` itself stays mounted, because unmounting it on
 * close is what breaks the native focus restore.
 *
 * It wears `.plate-view` for the geometry it already defines — `100vw`,
 * `100dvh`, the backdrop, and the `:has` rule that stops the page scrolling
 * underneath. Nothing else on the live site matches that class: `expandable`
 * is set on no current figure, so `ExpandedView` never opens, and the rules are
 * sitting there unused. `.plate-view__inner` is deliberately NOT reused — its
 * grid reserves a caption row, and a caption is what this view is for getting
 * away from.
 */
const VIEW = lazy(() => import('@/evidence/views/plant-growth/GrowthFieldView'))

/**
 * Read once, from the URL, like `hudEnabled` beside it in `dev/TimelineHUD.tsx`.
 *
 * A query parameter rather than something persisted. The flag should leave no
 * trace for an ordinary reader and no state to be surprised by on a later
 * visit; a link is also the only form of it that can be handed to someone else.
 */
export const researcherEnabled = (): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('researcher')

export function ResearcherView({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="plate-view researcher-view"
      // Fires for Escape and for `close()` alike, so React state cannot drift
      // out of sync with the element's own idea of whether it is open.
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      aria-label="Plant growth fields, researcher view"
    >
      {open ? (
        <>
          {/* A sibling of the frame, not a child of the view.
              `GrowthFieldView`'s host captures the pointer on `pointerdown` to
              drive the orbit, which retargets the `pointerup` and so eats the
              `click` of anything inside it — the bug that once left all nine of
              its own controls dead to a mouse. The rail escapes that with a
              `.closest('.growth-chrome')` test; this escapes it by not being in
              there at all.

              First in the DOM as well, so `showModal()` lands focus on the way
              out rather than somewhere in the middle of the apparatus. */}
          <button type="button" className="plate-view__close researcher-view__close" onClick={onClose}>
            Close
          </button>
          <div className="researcher-view__frame">
            {/* `active` unconditionally: a view the reader has deliberately
                opened full-screen is as active as a view gets. `beat` is
                `explore` because that is the one beat that hands the figure
                over — see `beatOf` and `interactive` in the view. */}
            <Suspense fallback={null}>
              <VIEW active beat="explore" />
            </Suspense>
          </div>
        </>
      ) : null}
    </dialog>
  )
}
