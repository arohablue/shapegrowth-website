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

      <span className="meta founder__tag">Founder {founder.index}</span>
      <h3 className="founder__name">{founder.name}</h3>
      <p className="meta founder__role">{founder.role}</p>
      <p className="section-body founder__bio">{founder.bio}</p>

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
