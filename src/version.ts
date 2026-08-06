/**
 * Release identifier for this build.
 *
 * `package.json` is the single source of truth for the number: the npm build
 * scripts pass it through as `REACT_APP_VERSION`, the Makefile stamps the same
 * value into the container image's OCI label, and the release workflow refuses
 * to publish a git tag that disagrees with it. So what the login page shows,
 * what `docker inspect` reports, and what the release is tagged as are one
 * number by construction.
 *
 * A build that supplies no version — a plain `docker build` with no
 * `--build-arg VERSION` — reports `dev`, which is the honest answer for an
 * untagged build rather than a number it cannot vouch for.
 *
 * Read at module load: Create React App inlines `process.env.REACT_APP_*` at
 * build time, so there is nothing to re-evaluate at runtime.
 */
const raw = (process.env.REACT_APP_VERSION ?? '').trim();

/**
 * e.g. `0.9.8.7`, or `dev` for an untagged build. Never carries a leading `v`.
 *
 * The four-component form is loxilb-io/loxilb's release scheme, which this
 * project versions in lockstep with — it is not semver.
 */
export const APP_VERSION = raw === '' ? 'dev' : raw.replace(/^v/, '');
