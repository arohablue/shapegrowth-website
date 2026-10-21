import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { OFFERINGS, OFFERINGS_COPY } from '@/content'
import type { Offering } from '@/content'
import { aspectOf, aspectValue } from '@/evidence/figure'
import { EVIDENCE_SOURCES } from '@/evidence/registry'
import { Figure, rubricOf } from '@/ui/Figure'
import { ResearcherView, researcherEnabled } from '@/ui/ResearcherView'

/**
 * Read once, at module scope, exactly as `App.tsx` reads `hudEnabled`.
 *
 * The URL cannot change without a reload on this page — there is no router —
 * so re-reading it per render would be a subscription to something that never
 * fires. A constant also lets the whole researcher branch below fold away to
 * nothing for every ordinary visitor.
 */
const RESEARCHER = researcherEnabled()

/** The one offering the researcher view is for. */
const RESEARCHER_OFFERING = 'plant-growth-fields'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT FOLLOWS THE RECONSTRUCTION
 * ────────────────────────────────────────────────────────────────────────────
 * Everything above this component is one specimen transforming across five
 * beats, driven by a single scroll value. This is the same argument made with
 * the underlying evidence: two measurement programmes, each a fixed sequence in
 * which every step is only legible as a consequence of the one before it.
 *
 *
 * WHY THE FIGURES SHARE ONE FRAME
 * ───────────────────────────────
 * Each offering is a sticky stage holding all of its plates in a single grid
 * cell, with a column of prose steps scrolling past it. One plate is on the
 * stage at a time; as each step arrives, the stage crossfades to that step's
 * representation.
 *
 * The problem this solves was measurable rather than aesthetic. Laid out as a
 * column of plates, the figure frame was 84% of the viewport height, a whole
 * plate was 102%, and the distance from one plate to the next was 115%. The
 * layout unit was larger than the window, so no two plates could ever be on
 * screen together — the reader saw a picture, then some words, then a picture,
 * and the fact that `Capture → Reconstruct → Geometry → Surface → Phenotype` is
 * one thing changing five times was never available to them. Making the gaps
 * smaller would not have fixed it; it would have produced a denser list.
 *
 * Sharing one frame states the sequence structurally. The frame does not move,
 * so what the reader perceives is the contents of a fixed rectangle being
 * replaced — which is what the pipeline actually does to the specimen.
 *
 *
 * WHY THE MOTION IS ALLOWED HERE NOW
 * ──────────────────────────────────
 * This file used to argue, at length, that the section should have no scroll
 * animation at all. Both halves of that argument were about a column of static
 * plates, and one of them survives the change with its conclusion inverted.
 *
 * The editorial half said: fading in a static figure on approach is motion
 * applied *to* content rather than motion that IS the content, which is the
 * house style of every scroll-animated template and reads as one instantly.
 * That test is still the right test, and the stage passes it where the fade did
 * not. Nothing here animates on arrival, nothing has an entrance, and no element
 * moves because it became visible. The only motion in the section is one
 * representation of a specimen being replaced by the next, which is the content.
 * The constraint that follows is sharp and worth stating as a rule: a transition
 * in this section must be a transition BETWEEN two pieces of evidence. There is
 * no budget for anything else — no parallax on the frame, no stagger on the
 * captions, no reveal on the steps.
 *
 * The architectural half said an IntersectionObserver here would be a second
 * timeline, in a codebase where `ProgressProvider` calls itself the only scroll
 * listener. That is a real cost and it is now being paid, so it should be paid
 * knowingly:
 *
 *   - It observes six `<li>`s and sets one integer. It reads nothing from the
 *     scene, writes nothing to it, and runs on `trailing`, which is the slot
 *     `ProgressProvider` explicitly does not measure. The two timelines cannot
 *     interfere because they do not share a value.
 *   - It is an observer and not a scroll handler, so it costs nothing per frame.
 *     The rule it bends exists to stop per-frame work accumulating, and this is
 *     not per-frame work.
 *   - The rule still holds where it was written. Nothing that touches the canvas,
 *     the rail or the annotations may read scroll position except through
 *     `ProgressProvider`. This section touches none of them.
 *
 * Under `prefers-reduced-motion: reduce` the observer is never created and the
 * stylesheet unstacks the grid cell into a plain column of plates — every figure
 * visible, nothing pinned, nothing fading. That is also exactly what renders if
 * the JavaScript above this component fails: `active` stays 0, but the reduced
 * layout is CSS-only and the full sequence is still readable. The fallback is
 * the old layout, which is the reason to be comfortable with the mechanism.
 *
 *
 * WHY IT IS OPAQUE AND SITS ABOVE EVERYTHING
 * ──────────────────────────────────────────
 * `.offerings` is `position: relative` with a solid void background and a
 * z-index above all the fixed chrome — canvas, legibility veil, measurement
 * annotations, grain and the progress rail. Those five are all `position: fixed`
 * and all of them are still on screen at the end of the experience: the rail
 * would sit at 100% next to unrelated content, and the seven annotation labels
 * would float over the figures, both of them pinned there forever.
 *
 * Scrolling an opaque panel over the top covers all five at once, with no new
 * state, no observer and no opacity tweening — the hand-off is just the page
 * moving. The alternative was fading each of them out on approach, which is five
 * coordinated animations to solve a problem that stacking order already solves.
 */
export function Offerings() {
  return (
    <section className="offerings" aria-label={OFFERINGS_COPY.title}>
      <div className="offerings__inner">
        <header className="offerings__masthead">
          <span className="eyebrow">{OFFERINGS_COPY.eyebrow}</span>
          {/* h2, matching the stage headings above it rather than opening a
              new h1 — this is a continuation of one document. */}
          <h2 className="offerings__title">{OFFERINGS_COPY.title}</h2>
          <p className="offerings__standfirst">{OFFERINGS_COPY.standfirst}</p>
        </header>

        {OFFERINGS.map((offering) => (
          <OfferingSequence key={offering.id} offering={offering} />
        ))}
      </div>
    </section>
  )
}

function OfferingSequence({ offering }: { offering: Offering }) {
  const { active, reduced, stepRef } = useActiveStep(offering.evidence.length)
  // Under reduced motion the stylesheet shows the whole run of plates at once,
  // so every one of them is "on the stage" — which is not cosmetic: `active`
  // also decides whether a plate offers its Enlarge control, and a run of six
  // visible figures with the control on the first is a bug, not a style.
  const isActive = (i: number) => reduced || i === active
  const continuous = isContinuous(offering)

  // Scoped to the one offering by construction rather than by a check somewhere
  // else, and `false` for everyone without the flag, so the branch below is
  // unreachable rather than merely hidden.
  const researcher = RESEARCHER && offering.id === RESEARCHER_OFFERING
  const [researcherOpen, setResearcherOpen] = useState(false)

  return (
    <article id={offering.id} className="offering">
      {/* The number is set large and the title beside it, the same arrangement
          as the plate captions above — index, rule, name on one baseline.
          Stacking a small label over a big heading is the landing-page move the
          page has avoided throughout. */}
      <header className="offering__head">
        <span className="offering__index">{offering.index}</span>
        <div className="offering__headline">
          <h3 className="offering__title">{offering.title}</h3>
          <p className="offering__lede">{offering.lede}</p>
        </div>
      </header>

      {/* The hand-off into the evidence, shown only where there is a sequence to
          hand off into. Its own rule, and one line per sentence — offering 02's
          hand-off is three statements that step from what we have to what is
          missing to what follows, and a paragraph that wrapped mid-clause would
          break that step into arbitrary halves. Authored as separate strings
          rather than split here; see the field docs in `content.ts`. */}
      {offering.bridge ? (
        <p className="offering__bridge">
          {offering.bridge.map((line) => (
            <span key={line} className="offering__bridge-line">
              {line}
            </span>
          ))}
        </p>
      ) : null}

      <div className="offering__sequence">
        {/* The stage comes first in the DOM as well as in the layout. The figure
            is the evidence and the step is the apparatus for reading it, which
            is the same ordering the plate itself uses; a reader who meets the
            prose first is reading a page that describes its illustrations. */}
        <div className="offering__stage">
          <div className="offering__stage-box" style={stageStyle(offering)}>
            {continuous ? (
              // ONE plate, whose figure changes under it. Deliberately not
              // keyed: React reconciles it by position, the element type is the
              // same `lazy` component at every beat, and so the view is never
              // unmounted. That is the whole mechanism — see `isContinuous`.
              //
              // Under reduced motion there is no scroll-driven beat to show, so
              // the stage goes to the last step, which is the one with the
              // controls. The reader reaches all six representations through
              // the rail instead of through the scroll, which is the same
              // material by a route that does not move on its own.
              <Figure
                figure={offering.evidence[reduced ? offering.evidence.length - 1 : active]!}
                offeringIndex={offering.index}
                // Stood down while the researcher view holds the screen. Not
                // cosmetic: `active` is what `GrowthFieldView` spends on
                // `frameloop`, so without this the plate keeps running a render
                // loop over 3,000 points behind an opaque backdrop, and the two
                // instances compete for the same GPU to draw one of them where
                // nobody can see it. Making the dialog inert does not help —
                // inertness is about focus and hit-testing, and the view's own
                // IntersectionObserver still reports it on screen.
                //
                // It costs the plate's 560ms crossfade on the way back, which
                // is a fade-in after the dialog has already gone.
                active={!researcherOpen}
              />
            ) : (
              offering.evidence.map((figure, i) => (
                <Figure
                  key={figure.id}
                  figure={figure}
                  offeringIndex={offering.index}
                  active={isActive(i)}
                />
              ))
            )}
          </div>

          {/* Inside the stage rather than anywhere global. A corner button
              beside the theme toggle would read as a page-wide mode, and this
              is one figure's; put beside the figure, it says which. It is also
              the element `showModal()` restores focus to on close, so it has to
              be somewhere a reader would expect to land. */}
          {researcher ? (
            <>
              <button
                type="button"
                className="researcher-open"
                onClick={() => setResearcherOpen(true)}
              >
                Open researcher view
              </button>
              <ResearcherView open={researcherOpen} onClose={() => setResearcherOpen(false)} />
            </>
          ) : null}
        </div>

        {/* An ordered list because it is one: a fixed sequence whose numbering
            is part of the claim. The figure number is repeated on the step so a
            step can be read on its own — which is how it arrives for anyone
            reading the figures and the steps as two separate runs. */}
        <ol className="offering__steps">
          {offering.evidence.map((figure, i) => (
            <li
              key={figure.id}
              ref={stepRef(i)}
              className="offering__step"
              data-active={isActive(i)}
            >
              <p className="offering__step-head">
                <span className="offering__step-stage">{rubricOf(figure)}</span>
                <span className="offering__step-fig">
                  Fig. {offering.index}.{figure.index}
                </span>
              </p>
              <p className="offering__step-body">{figure.summary}</p>
            </li>
          ))}
        </ol>
      </div>
    </article>
  )
}

/**
 * Whether this offering's plates are N readings of ONE figure rather than N
 * figures — in which case the stage mounts that figure once and lets the
 * reader's position in the column choose what it shows.
 *
 * Offering 02 is the case it exists for. Its six plates are six
 * representations of one pair of scans, all filled by `GrowthFieldView`, and
 * the scroll through them is the DAY t → DAY t+1 → REGISTRATION → DISPLACEMENT
 * → DEFORMATION → EXPLORE sequence. Offering 01 is three unrelated figures and
 * is unaffected.
 *
 *
 * WHY IT IS DERIVED AND NOT DECLARED
 * ──────────────────────────────────
 * The alternative was a flag on `Offering` saying `continuous: true`, which is
 * a second statement of something the registry already states and which can
 * therefore be wrong. The condition here is not a convention — it is the exact
 * technical precondition for the stage to work: the same component reference at
 * every slot is what lets React keep one instance mounted across a beat change.
 * If that stops being true, the derived answer stops being `true` with it and
 * the offering falls back to the stack of crossfading plates, which still
 * renders correctly. A declared flag would instead produce six mounts of six
 * different components in one grid cell, silently.
 *
 *
 * WHY THE STACK IS NOT JUST ALWAYS THIS
 * ─────────────────────────────────────
 * Because the crossfade is right for offering 01 and wrong here. Three
 * different photographs dissolving into each other is a transition between two
 * pieces of evidence; one plant cutting from its own displacement field to its
 * own determinant map is the same object being re-described, and holding it
 * still through that is the point. The stack also keeps all N plates in the
 * accessibility tree at once, which is correct when they are N figures and a
 * lie when they are one.
 */
function isContinuous(offering: Offering): boolean {
  const sources = offering.evidence.map((figure) => EVIDENCE_SOURCES[figure.id])
  const first = sources[0]
  if (sources.length < 2 || first?.type !== 'component') return false
  return sources.every((s) => s?.type === 'component' && s.component === first.component)
}

/**
 * The stage's height budget, as the narrowest ratio among the plates it holds.
 *
 * Every plate in an offering occupies the same grid cell, so the cell is as tall
 * as the tallest of them — width ÷ the smallest ratio. The stylesheet caps the
 * stage against the viewport's height and has to express that cap as a width,
 * because the box is sized by its ratio and clamping the height would leave the
 * width alone (see the note on `.offering__stage-box`). Turning a height budget
 * into a width means multiplying by a ratio, and the only ratio that keeps every
 * plate inside the budget is the smallest one.
 *
 * It used to be the literal `16 / 9` in the stylesheet, with a comment conceding
 * it was "the ratio every figure currently declares" — true only because the
 * demo schematics were drawn that way. The moment one real portrait figure lands
 * it stops being true, and the failure is quiet: the stage grows past the height
 * it was capped at and pushes the step's rubric behind itself, which was the
 * exact defect the cap was added to fix. Deriving it from the data is what makes
 * the cap survive the assets changing under it.
 *
 * Recomputed on every render and deliberately not memoised: it is N divisions
 * over at most six plates, from module-scope constants, and a `useMemo` here
 * would cost more to read than it saves to run.
 */
function stageStyle(offering: Offering): CSSProperties {
  const ratios = offering.evidence.map((figure) =>
    aspectValue(aspectOf(figure, EVIDENCE_SOURCES[figure.id])),
  )
  // Stringified rather than handed over as a number. React does not append `px`
  // to custom properties, so a bare number would work — but that is a detail of
  // React's style handling, and `calc()` silently producing nothing is an
  // invisible failure. A string cannot be unit-mangled by anything.
  return { '--stage-aspect': Math.min(...ratios).toFixed(4) } as CSSProperties
}

/**
 * Which step is currently being read, as an index.
 *
 * The observer watches a thin band across the middle of the viewport — 10% tall,
 * from the `-45%` insets — so a step becomes current at the moment it crosses
 * the centre line, not when it enters the screen. Entering the screen is the
 * wrong trigger for a sticky stage: a step is visible for most of the time the
 * step before it is the one being read.
 *
 * Whenever the band's occupancy changes, the active step is recomputed from
 * scratch as whichever one's centre is nearest the viewport's. The obvious
 * alternative — take the index off whichever entry reported `isIntersecting` —
 * is only correct while entries arrive one at a time, and a fast scroll or a
 * jump to an anchor delivers several in one callback with no defined order. Six
 * `getBoundingClientRect` calls on an event that fires a handful of times per
 * sequence is not a cost worth trading for a race.
 *
 * Under `prefers-reduced-motion: reduce` no observer is created at all and
 * `reduced` is returned instead, which the caller reads as "every step is
 * current". The stylesheet lays the plates out as a plain column in that mode,
 * so there is no stage for one of them to be on.
 *
 * Read in a `useState` initialiser rather than an effect, so the first render is
 * already correct and there is no frame in which the page commits to the wrong
 * layout. Queried once rather than subscribed to: the layout is CSS and switches
 * the instant the OS setting changes, and the observer — whose only job is to
 * drive a transition that no longer runs — comes back on the next navigation.
 */
function useActiveStep(count: number) {
  const [active, setActive] = useState(0)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const steps = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    if (reduced) return

    const nodes = steps.current.filter((node): node is HTMLLIElement => node !== null)
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      () => {
        const middle = window.innerHeight / 2
        let nearest = 0
        let best = Infinity
        nodes.forEach((node, i) => {
          const box = node.getBoundingClientRect()
          const distance = Math.abs(box.top + box.height / 2 - middle)
          if (distance < best) {
            best = distance
            nearest = i
          }
        })
        setActive(nearest)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [count, reduced])

  return {
    active,
    reduced,
    stepRef: (i: number) => (node: HTMLLIElement | null) => {
      steps.current[i] = node
    },
  }
}
