import DenseCloud from './DenseCloud'

/**
 * Plate 01.03 — the dense cloud with the measurement pass drawn over it.
 *
 * A module of its own, for one reason that is not stylistic: `isContinuous` in
 * `Offerings.tsx` decides a run of plates is ONE figure by comparing the
 * registry's `component` references with `===`. Registering `DenseCloud`
 * itself for both 01.02 and 01.03 would make those two compare equal, and the
 * moment 01.01 stops being an image the offering would silently collapse into
 * a single shared view with a beat switch — which is the right structure for
 * offering 02 and the wrong one here, where the three plates are three
 * different things.
 *
 * So the identity is the deliverable and the body is a prop. The alternative,
 * a second copy of the view, would duplicate the orbit and input handling that
 * `DenseCloud` documents at length and must not drift from.
 */
export default function TraitCalipers({ active }: { readonly active?: boolean }) {
  return <DenseCloud active={active} calipers />
}
