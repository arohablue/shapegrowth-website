import { useEffect, useRef, useState } from 'react'
import { SECTION_COPY } from '@/content'
import { aspectOf, CATEGORY_LABEL, resolveAspect } from '@/evidence/figure'
import type { ScientificFigure } from '@/evidence/figure'
import { EVIDENCE_SOURCES } from '@/evidence/registry'
import type { EvidenceSource } from '@/evidence/registry'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * ONE PLATE COMPONENT, EIGHT CATEGORIES OF FIGURE, ONE SETTING, NO CARD
 * ────────────────────────────────────────────────────────────────────────────
 * Every figure on the page renders through here — all eleven, across both
 * offerings — whether it is a photograph, a plot, a micrograph, a segmentation
 * overlay, a point cloud, a map, a field or a diagram. Adding a twelfth is a
 * `ScientificFigure` in `content.ts` and an `EvidenceSource` in `registry.ts`.
 * Nothing in this file changes, and nothing in the stylesheet does either.
 *
 * That is deliberate. A section built from eight specialised figure components
 * drifts apart visually within a month, because each one gets adjusted in
 * isolation and nobody ever looks at them side by side. One component means the
 * frame, the label, the caption and the spacing are the same by construction
 * rather than by discipline.
 *
 * There was briefly a second setting — a compact two-column index, used for the
 * offering that had no material yet. It is gone. Two equal columns of equal
 * boxes is structurally a card grid however the borders are styled: it sets
 * every item at the same weight, in a scanning order, and invites the reader to
 * compare rather than to read in sequence. Offering 02's six figures are a
 * sequence in which each is only meaningful as a consequence of the last, and a
 * grid states the opposite.
 *
 * What is left is what a journal figure does. The figure occupies the measure
 * with its number and title set underneath at caption scale, so the figure is
 * the largest thing in the viewport and every word on the plate is subordinate
 * to it.
 *
 *
 * WHAT THIS COMPONENT STOPPED OWNING
 * ──────────────────────────────────
 * Two things that used to be on the plate now sit outside it, because the plates
 * are stacked into one sticky stage and only one of them is on screen at a time
 * (see `Offerings.tsx`).
 *
 *   - The stage rubric, which was a hairline above the figure. One word visible
 *     at a time never read as a sequence; it is now a term in the arc at the
 *     offering's head and a heading on the scrolling step beside the stage,
 *     both of which show the whole chain with the current term marked.
 *   - The interpretation — `figure.summary` — which is now the body of that
 *     step. It is the thing the reader is reading *while* the figure is on the
 *     stage, so it belongs in the column that scrolls, not on the plate that
 *     holds still.
 *
 * What stays on the plate is what has to travel with the image and would be
 * meaningless detached from it: `Fig. 02.04`, the figure's own title, and the
 * apparatus. The `<figcaption>` binding survives intact, which is the reason to
 * be careful about where the split falls rather than splitting on length.
 *
 *
 * WHY THE BOX EXISTS BEFORE THE CONTENT DOES
 * ──────────────────────────────────────────
 * `aspect-ratio` reserves the full height now, so dropping a real asset in later
 * shifts nothing. The alternative — letting slots collapse until filled — means
 * the page's whole rhythm changes on the day the first figure lands, and every
 * spacing decision made before then was made against a layout that no longer
 * exists. On the stage it does a second job: all N plates occupy one grid cell,
 * so the cell's height is the tallest of them, and a plate that collapsed would
 * make the stage resize as the reader scrolled through it.
 */

/**
 * The name of the stage or phase this figure belongs to, or null.
 *
 * Two sources, one rule. `stage` is a checked reference into `SECTION_COPY` —
 * the table the progress rail and the three scroll headings also read — so a
 * plate in offering 01 cannot be labelled with a beat that no longer matches the
 * animation above it. `phase` is offering 02's own sequence, which has no
 * counterpart in the scroll to point at. See the field docs in `figure.ts`.
 *
 * Exported because the arc and the steps in `Offerings.tsx` need the same
 * answer, and `verify-narrative.mjs` asserts these terms against the offering's
 * printed chain word for word. Two copies of this expression is how that
 * assertion starts passing against a term nobody renders.
 */
export function rubricOf(figure: ScientificFigure): string | null {
  return figure.stage ? SECTION_COPY[figure.stage].title : (figure.phase ?? null)
}

/**
 * The published-figure setting, and the only one.
 *
 *
 * WHY THE FIGURE COMES FIRST
 * ──────────────────────────
 * An earlier arrangement put the title and the description in a side column to
 * the LEFT of the figure, which meant the reading order was prose, then image.
 * That is a page describing its illustrations. A journal plate is the other way
 * round — the figure occupies the measure, and everything written about it sits
 * underneath it in a caption, because the figure is the evidence and the words
 * are the apparatus for reading it.
 *
 * So the order here is exactly the hierarchy, top to bottom:
 *
 *   1. the figure, full measure, the largest thing in the viewport
 *   2. `Fig. 01.01` and the short scientific title, on one baseline
 *   3. one or two sentences on what the figure demonstrates
 *   4. the apparatus — key, metadata, reference — only if the figure has them
 *
 * Levels 2–4 are one `<figcaption>`, set at caption scale — smaller than the
 * body type anywhere else on the page. The temptation is to make the title large
 * because it is a heading; that would make it compete with the figure, and the
 * whole point of the setting is that nothing does.
 *
 *
 * SEMANTICS
 * ─────────
 * `<figure>` + `<figcaption>` rather than divs, so the caption is programmatically
 * bound to the image instead of merely sitting under it. The title inside the
 * caption is a real `<h4>`, continuing `h2` (section) → `h3` (offering) → `h4`
 * (plate), which is what lets a screen reader user jump between plates from the
 * heading list. It is set at 11px; a heading's level and its size are unrelated,
 * and only one of them is addressed to the reader.
 *
 *
 * WHAT IS ABOVE THE FIGURE
 * ────────────────────────
 * Nothing. The hairline that used to carry the stage name is gone; see the top
 * of this file.
 */
export function Figure({
  figure,
  offeringIndex,
  active,
}: {
  figure: ScientificFigure
  /**
   * The owning offering's number, used only to qualify the figure label.
   *
   * Figure numbers restart at 01 in each offering, which is right — they are two
   * studies, and offering 02's sequence is six long whatever offering 01 did.
   * But both are on one continuously scrolling page, so unqualified labels put
   * two `Fig. 03`s four thousand pixels apart with nothing distinguishing them.
   * `Fig. 01.03` and `Fig. 02.03` are unambiguous and are how a document with
   * numbered parts sets them anyway.
   */
  offeringIndex: string
  /**
   * Whether this plate is the one currently on the stage.
   *
   * Drives `data-active`, which is the entire crossfade — the stylesheet owns
   * the opacity and the easing, and this component does not know how the swap
   * looks. It also gates the Enlarge control, which is the only focusable thing
   * on a plate: the inactive plates stay in the accessibility tree so the six
   * figures still read as six figures, but a button nobody can see must not be
   * reachable by Tab.
   */
  active: boolean
}) {
  const source = EVIDENCE_SOURCES[figure.id]
  const number = `Fig. ${offeringIndex}.${figure.index}`

  return (
    <figure id={figure.id} className="plate" data-active={active}>
      <Frame figure={figure} source={source} number={number} interactive={active} />

      <figcaption className="plate__caption">
        <span className="plate__fig">{number}</span>
        <div className="plate__legend">
          <h4 className="plate__title">{figure.label}</h4>
          <Apparatus figure={figure} />
        </div>
      </figcaption>
    </figure>
  )
}

/**
 * The reserved box, whatever is currently in it, and the enlarge control when
 * the figure has both an asset and a reason to be looked at closely.
 */
function Frame({
  figure,
  source,
  number,
  interactive,
}: {
  figure: ScientificFigure
  source: EvidenceSource | undefined
  number: string
  interactive: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const offerExpand = figure.expandable === true && source !== undefined
  // Scrolling the plate off the stage closes the enlarged view rather than
  // leaving it open over a figure that is no longer the one being discussed.
  // `<dialog>` does not stop the page scrolling underneath it, so this is
  // reachable, and routing it through `open` means the close goes through the
  // element's own `close()` and its focus restore rather than an unmount.
  const isOpen = expanded && interactive
  // The asset's ratio if it declared one, the reserved box's if not. This is the
  // line that lets a real figure of any shape land without the layout being
  // edited to receive it — see `aspectOf`.
  const ratio = resolveAspect(aspectOf(figure, source))

  return (
    <div className="evidence__frame" style={{ aspectRatio: ratio }}>
      {source ? <Media source={source} /> : <Placeholder figure={figure} />}

      {offerExpand ? (
        <>
          {/* A real <button>, so it is tab-reachable, Enter/Space-activated and
              announced as a control — and visible at rest rather than on hover,
              because a control that appears on hover does not exist for a
              keyboard or a touchscreen. It costs one line of 10px mono in a
              corner, which is cheaper than the two failure modes. */}
          {interactive ? (
            <button
              type="button"
              className="plate__expand"
              onClick={() => setExpanded(true)}
              aria-label={`Enlarge ${number}, ${figure.label}`}
            >
              Enlarge
            </button>
          ) : null}
          <ExpandedView
            figure={figure}
            source={source}
            number={number}
            open={isOpen}
            onClose={() => setExpanded(false)}
          />
        </>
      ) : null}
    </div>
  )
}

/**
 * The enlarged view, on a native `<dialog>`.
 *
 *
 * WHY `<dialog>` AND NOT A PORTAL WITH A FOCUS TRAP
 * ────────────────────────────────────────────────
 * `showModal()` gives, for free and correctly, every part of this that is
 * usually got wrong by hand: focus moves into the dialog, focus cannot leave it
 * while it is open, everything behind it goes inert to both pointer and
 * assistive technology, Escape closes it, and focus returns to the element that
 * opened it. The hand-rolled version is fifty lines of keydown handling and
 * `aria-hidden` bookkeeping that is subtly wrong on at least one browser.
 *
 * The children render only while open. The reason is not memory — it is that a
 * `component` source may be a WebGL view, and mounting one inside a closed
 * dialog would hold a second GL context open for the life of the page. The
 * `<dialog>` element itself stays mounted, because unmounting it on close is
 * what breaks the native focus restore.
 */
function ExpandedView({
  figure,
  source,
  number,
  open,
  onClose,
}: {
  figure: ScientificFigure
  source: EvidenceSource
  number: string
  open: boolean
  onClose: () => void
}) {
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
      className="plate-view"
      // Fires for Escape and for `close()` alike, so React state cannot drift
      // out of sync with the element's own idea of whether it is open.
      onClose={onClose}
      // Clicking the backdrop. The dialog's own box is the event target only
      // when the click missed every child, which is exactly the backdrop.
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      aria-label={`${number}, ${figure.label} — enlarged`}
    >
      {open ? (
        <div className="plate-view__inner">
          {/* First in the DOM, so `showModal()` lands focus on the way out
              rather than on the image. */}
          <button type="button" className="plate-view__close" onClick={onClose}>
            Close
          </button>
          <div className="plate-view__frame">
            <Media source={source} expanded />
          </div>
          <p className="plate-view__caption">
            <span className="plate-view__fig">{number}</span>
            {figure.label}
            {figure.caption ? <span className="plate-view__key">{figure.caption}</span> : null}
          </p>
        </div>
      ) : null}
    </dialog>
  )
}

/**
 * The asset itself. Switches on the source's own `type`, never on anything the
 * figure declares — the file knows what it is, and the two cannot disagree.
 */
function Media({ source, expanded = false }: { source: EvidenceSource; expanded?: boolean }) {
  const className = expanded ? 'evidence__media evidence__media--expanded' : 'evidence__media'

  if (source.type === 'component') {
    const View = source.component
    // The component draws pixels and has no accessible name of its own, so the
    // wrapper carries one. Without this a point cloud is an empty element.
    return (
      <div className={className} role="img" aria-label={source.alt}>
        <View />
      </div>
    )
  }

  if (source.type === 'video') {
    return (
      <video
        className={className}
        src={source.src}
        poster={source.poster}
        // Muted, looping, inline and autoplaying: these are observations of a
        // plant, not media the reader chose to watch, so controls would imply a
        // decision they do not need to make. `playsInline` keeps iOS from taking
        // it fullscreen. In the enlarged view controls ARE offered, because
        // there the reader did choose, and scrubbing a time series is the reason
        // they opened it.
        muted
        loop
        playsInline
        autoPlay
        controls={expanded}
        aria-label={source.alt}
      />
    )
  }

  return (
    <img
      className={className}
      src={source.src}
      alt={source.alt}
      // Eager in the enlarged view: it was asked for, and a spinner behind a
      // modal the reader just opened is worse than a moment of nothing.
      loading={expanded ? 'eager' : 'lazy'}
    />
  )
}

/**
 * Level 4: the apparatus — the figure's key, its metadata, and where it came
 * from. All optional, in that order, and the whole block disappears if the
 * figure carries none of them.
 *
 * Two registers rather than three. `caption` is prose about the plate and is set
 * in the prose face, one notch dimmer than the interpretation above it, because
 * it is read *while* looking at the figure. `metadata` and `reference` are set
 * in mono micro-type with a hanging label, because they are apparatus: a reader
 * either goes looking for them or never sees them, and the label is what makes
 * them findable at a glance without a heading.
 *
 * The labels are real spans and not `::before` content, so they are selectable
 * and survive being copied out of the page — which is the main thing anyone does
 * with a citation.
 *
 * All of it is undefined on all eleven plates today. That is enforced, not
 * incidental: see the field docs in `figure.ts` for why a plausible wrong line
 * here is the failure mode this section is built to make impossible.
 */
function Apparatus({ figure }: { figure: ScientificFigure }) {
  const rows = figure.metadata ?? []
  if (!figure.caption && rows.length === 0 && !figure.reference) return null

  return (
    <div className="plate__apparatus">
      {figure.caption ? <p className="plate__key">{figure.caption}</p> : null}
      {rows.map((row) => (
        <p key={row.label} className="plate__note">
          <span className="plate__note-label">{row.label}</span>
          {row.value}
        </p>
      ))}
      {figure.reference ? (
        <p className="plate__note">
          <span className="plate__note-label">Ref.</span>
          {figure.reference}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The unfilled state, and the only part of this page that is loud.
 *
 * Written in capitals and in brackets because a placeholder that blends in is a
 * placeholder that ships. A soft grey rectangle reads as an intentional design
 * element to everyone who did not write it — including us, three weeks from now.
 * This cannot be mistaken for finished.
 */
function Placeholder({ figure }: { figure: ScientificFigure }) {
  return (
    <div className="evidence__placeholder">
      <span className="evidence__kind">{CATEGORY_LABEL[figure.category]}</span>
      <span className="evidence__pending">{figure.placeholder}</span>
    </div>
  )
}
