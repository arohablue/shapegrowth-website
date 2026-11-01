import { ABOUT_COPY, FOUNDERS } from '@/content'
import type { Founder } from '@/content'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * ABOUT / TEAM
 * ────────────────────────────────────────────────────────────────────────────
 * A trailing sibling of the measured root, like `Offerings` and `Contact` on
 * either side of it — never a `BLOCKS` entry, so it does not retime the
 * reconstruction. See the two-slot note in `ProgressProvider`.
 *
 * Two founder blocks, side by side on desktop and stacked on mobile. No card
 * chrome — no fill, no radius, no shadow — matching the index above it: a
 * hairline divides the pair instead of a border drawing a box around each one.
 */
export function About() {
  return (
    <section className="about" aria-labelledby="about-title">
      <div className="about__inner">
        <header className="about__masthead">
          <span className="eyebrow">{ABOUT_COPY.eyebrow}</span>
          <h2 className="about__title" id="about-title">
            {ABOUT_COPY.title}
          </h2>
        </header>

        <div className="about__founders">
          {FOUNDERS.map((founder) => (
            <FounderBlock key={founder.id} founder={founder} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FounderBlock({ founder }: { founder: Founder }) {
  return (
    <article className="founder">
      <div className="founder__portrait" aria-hidden={founder.image ? undefined : true}>
        {founder.image ? (
          <img src={founder.image} alt={founder.name} className="founder__photo" />
        ) : null}
      </div>

      <span className="meta founder__tag">Founder</span>
      <h3 className="founder__name">{founder.name}</h3>
      <p className="meta founder__role">{founder.role}</p>
      <p className="section-body founder__bio">{founder.bio}</p>

      {founder.email ? <EmailLink email={founder.email} /> : null}

      {founder.linkedin ? (
        <a
          className="founder__link"
          href={founder.linkedin}
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
      ) : null}
    </article>
  )
}

/**
 * The address is harvest-resistant by construction: `content.ts` stores the
 * user and domain as separate fields, the visible text joins them with
 * ` [at] `, and the real `mailto:` URL exists only for the instant the click
 * handler runs. At no point — source, bundle, or rendered DOM — does
 * `user@domain` sit anywhere a regex can find it.
 *
 * An `<a>` rather than a styled button so it reads, focuses and announces as
 * the link it is; the `#` href is never followed because the handler always
 * prevents it.
 */
function EmailLink({ email }: { email: NonNullable<Founder['email']> }) {
  return (
    <a
      className="founder__link"
      href="#"
      onClick={(event) => {
        event.preventDefault()
        window.location.href = `mailto:${email.user}@${email.domain}`
      }}
    >
      {email.user}&#8201;[at]&#8201;{email.domain}
    </a>
  )
}
