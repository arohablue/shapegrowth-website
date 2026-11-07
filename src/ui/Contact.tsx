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
 * message, one that shows the address in harvest-resistant form.
 *
 * Both links used to carry the address in their `href` and worked with
 * JavaScript off. That property is traded away deliberately: an address in an
 * `href` is an address in the DOM, and harvesters regex the DOM. The same
 * pattern as `EmailLink` in `About.tsx` applies now — `content.ts` stores user
 * and domain apart, the visible text joins them with ` [at] `, and the real
 * `mailto:` URL exists only for the instant a click handler runs.
 */

/**
 * The only places the two halves of the address ever meet. Assembled per click
 * rather than at module scope, because a module-scope constant would put the
 * joined address back in the bundle for the lifetime of the page.
 *
 * `encodeURIComponent`, not a template literal, for subject and body: the
 * subject carries an em dash and the body carries newlines, and both have to
 * survive the URL. The em dash is the more interesting of the two — it is a
 * multi-byte character, so an unencoded `mailto:` is not merely untidy, some
 * clients truncate the subject at the first byte they cannot parse.
 * `encodeURIComponent` also escapes the `&` that would otherwise start a new
 * header field, which is the mailto equivalent of an injection and the reason
 * this is not assembled by hand.
 */
function address() {
  return `${CONTACT_COPY.address.user}@${CONTACT_COPY.address.domain}`
}

function openDraft() {
  window.location.href = `mailto:${address()}?subject=${encodeURIComponent(
    CONTACT_COPY.subject,
  )}&body=${encodeURIComponent(CONTACT_COPY.bodyHint.join('\n\n'))}`
}

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
          {/* An anchor so it reads, focuses and announces as the link it is;
              the `#` href is never followed because the handler prevents it.
              Middle-click and "copy link" are casualties of keeping the
              address out of the DOM — see the note at the top of the file. */}
          <a
            className="contact__action"
            href="#"
            onClick={(event) => {
              event.preventDefault()
              openDraft()
            }}
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

        {/* The plain address, no subject or body, for someone who wants the
            string itself — shown as ` [at] ` so the string a harvester wants
            never appears, joined only when clicked. The thin spaces are
            `&#8201;`, matching `EmailLink`. */}
        <a
          className="contact__direct"
          href="#"
          onClick={(event) => {
            event.preventDefault()
            window.location.href = `mailto:${address()}`
          }}
        >
          {CONTACT_COPY.address.user}&#8201;[at]&#8201;{CONTACT_COPY.address.domain}
        </a>
      </div>
    </section>
  )
}
