import { CONTACT_COPY } from '@/content'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE CLOSING INVITATION
 * ────────────────────────────────────────────────────────────────────────────
 * Last section of the page, after the evidence panel. Like `Offerings` it is a
 * `trailing` sibling of the measured root, never a `BLOCKS` entry — see the
 * two-slot note in `ProgressProvider`. Putting it in the reconstruction's
 * timeline would rescale all three beats.
 *
 * It has no state, no submit handler and no network call, and that is the
 * design rather than a shortcut. This is a static Vite build deployed to GitHub
 * Pages, so there is nothing to POST to; a form here would have to be a
 * third-party endpoint or a fake. Two links instead — one that opens a drafted
 * message, one that is simply the address — and both work with JavaScript off.
 */

/**
 * Built once at module scope because it is a constant.
 *
 * `encodeURIComponent`, not a template literal: the subject carries an em dash
 * and the body carries newlines, and both have to survive the URL. The em dash
 * is the more interesting of the two — it is a multi-byte character, so an
 * unencoded `mailto:` is not merely untidy, some clients truncate the subject at
 * the first byte they cannot parse. `encodeURIComponent` also escapes the `&`
 * that would otherwise start a new header field, which is the mailto equivalent
 * of an injection and the reason this is not assembled by hand.
 */
const MAILTO = `mailto:${CONTACT_COPY.address}?subject=${encodeURIComponent(
  CONTACT_COPY.subject,
)}&body=${encodeURIComponent(CONTACT_COPY.bodyHint.join('\n\n'))}`

export function Contact() {
  return (
    <section className="contact" aria-labelledby="contact-title">
      <div className="contact__inner">
        <span className="eyebrow">{CONTACT_COPY.eyebrow}</span>
        {/* h2, matching the stage headings and the offerings masthead. The page
            opens exactly one h1, in the hero. */}
        <h2 className="contact__title" id="contact-title">
          {CONTACT_COPY.title}
        </h2>
        <p className="contact__standfirst">{CONTACT_COPY.standfirst}</p>

        <div className="contact__actions">
          {/* An anchor, not a button. It navigates, so it should be the element
              that navigates: middle-click and "copy link" work, and a keyboard
              gets Enter without an onClick handler existing at all. */}
          <a
            className="contact__action"
            href={MAILTO}
            aria-label={`${CONTACT_COPY.action} — ${CONTACT_COPY.hint}`}
          >
            {CONTACT_COPY.action}
          </a>
          {/* `aria-hidden` with the same words repeated in the link's own
              accessible name. A screen reader that met this as loose text after
              the link would hear the warning after acting on it, which is too
              late to be a warning. */}
          <span className="contact__hint" aria-hidden="true">
            {CONTACT_COPY.hint}
          </span>
        </div>

        {/* Plain address, no subject or body. Someone who skips the drafted
            message wants the string itself — to copy it, or to send from an
            account that is not their default. */}
        <a className="contact__direct" href={`mailto:${CONTACT_COPY.address}`}>
          {CONTACT_COPY.address}
        </a>
      </div>
    </section>
  )
}
