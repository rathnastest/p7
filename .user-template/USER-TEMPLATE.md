# User template notes (Galascribe-internal)

This file, and the rest of `.user-template/`, is for Galascribe's own generation
step. It is not part of a generated publication repository: Galascribe
deletes `.user-template/` in the identity commit it makes immediately after
generating a new repository from this user template, so a person writing an
article never sees it.

## Placeholders Galascribe must rewrite

Every value below is schema-valid as shipped (so the user template passes
`.user-template/scripts/verify-user-template.mjs` unmodified), but it is a stand-in.
Galascribe must replace all of them when it generates a repository for a
real publication.

| File | JSON pointer | Meaning | Placeholder value |
| --- | --- | --- | --- |
| `gala/repository.json` | `/publicationId` | The publication's stable id. Must equal `gala/publication.json`'s `/id`. | `00000000-0000-7000-8000-000000000001` |
| `gala/publication.json` | `/id` | The publication's stable id (same value as above). Immutable once published. | `00000000-0000-7000-8000-000000000001` |
| `gala/publication.json` | `/slug` | The publication's URL-safe slug. | `my-publication` |
| `gala/publication.json` | `/title` | The publication's display name. | `PLACEHOLDER-My Publication` |
| `gala/publication.json` | `/description` | One or two sentences describing the publication. | `PLACEHOLDER description of this publication, one or two sentences.` |
| `gala/publication.json` | `/canonicalBase` | The publication's real base URL (the GitHub Pages URL, or a custom domain). | `https://example.invalid/` |
| `gala/publication.json` | `/defaultLanguage` | The publication's default BCP-47 language tag, if not English (US). | `en-US` |
| `gala/authors/placeholder-author.json` | `/id` | The author's stable id. Must equal every `authors` array entry that references this person (`gala/publication.json` references the file, not the id directly; `content/*.md` frontmatter `authors` arrays reference the id). | `00000000-0000-7000-8000-000000000002` |
| `gala/authors/placeholder-author.json` | `/displayName` | The author's real display name. | `PLACEHOLDER Author Name` |
| `gala/authors/placeholder-author.json` | `/biography` | The author's real short biography. | `PLACEHOLDER short author biography.` |
| `content/welcome-to-your-publication.md` | frontmatter `authors[0]` | Must equal the rewritten author id above. | `00000000-0000-7000-8000-000000000002` |
| `content/about.md` | frontmatter `authors[0]` | Must equal the rewritten author id above. | `00000000-0000-7000-8000-000000000002` |
| `.github/workflows/gala-publish-v2.yml` | the `uses:` pin after `@` and `with.publish_toolchain_ref` | The exact `rathnasgala2/publish` commit SHA Gala tells the owner to pin in both caller fields. This is the one caller-contract value `publish/docs/callers/README.md` documents as author-replaceable; it is not Galascribe-generated data, it is a Gala-provided pin. | `dee3e30c4744cb87ec3c944bb90e7c778e3529a2` |
| `.github/workflows/gala-publish-v2.yml` | `with.service_origin_catalog_url` | The signed Gala service-origin catalog location, provided by Gala. | `https://api.galascribe.com/v2/service-origins` |
| `.github/workflows/gala-publish-v2.yml` | `with.gala_api_origin` | The Gala API origin used for publish authorization and reporting. | `https://api.galascribe.com` |

Stable ids above follow the schema's UUIDv7-shaped pattern
(`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`); a
real generation must mint real UUIDv7 values, not reuse these placeholders,
and must never reuse a placeholder value across two generated repositories.

## `content/` layout: a known, current limitation

The product spec's recommended DEC-006 layout groups content under
`content/articles/` and `content/pages/`. As of this user template's creation,
`publish-action`'s own repository-intake step
(`packages/publish-action/src/normalize/repository-intake.js`) documents a
scope reduction: it reads `content/*.md` directly and does not evaluate
`repository.json`'s `contentRoots` globs or recurse into subdirectories.
This user template therefore keeps both the welcome article and the About page as
flat files directly under `content/`, and `gala/repository.json` declares a
single `contentRoots` entry (`kind: article`, `path: content`) matching the
one `publish-action` actually reads — the same shape as
`publish/packages/publish-action/test/fixtures/minimal-repository`. `kind`
on each file's own frontmatter (`article`/`page`) is what actually
distinguishes an article from a page; the directory does not. When
`publish-action` implements subdirectory content roots, this user template (and
its `repository.json`) should move to `content/articles/`/`content/pages/`
and this note should be deleted.

## `gala.lock.json`: hand-authored, not resolver-produced

There is no `resolve` (or similarly named) command in `publish-action`
today — its CLI has exactly three subcommands, `validate`, `build` and
`preview` (`src/bin/cli.js`), and no other package in this workspace
produces a lockfile either. `gala.lock.json` was therefore hand-authored,
following exactly the shape of
`publish/packages/publish-action/test/fixtures/minimal-repository/gala.lock.json`
(the real fixture the package's own tests exercise), with real package
versions substituted where they are known from this workspace's checkouts:
`@rathnasgala2/schemas@2.11.0` (the registry version `publish-action`
actually pins and installs), `@rathnasgala2/template@2.1.0`,
`@rathnasgala2/theme-default@2.1.0`, `@rathnasgala2/publish-action@0.1.0`,
`@rathnasgala2/publish-kernel@0.1.1`, `@rathnasgala2/adapter-protocol@0.2.1`
and `@rathnasgala2/adapter-github-pages@0.1.1`. The `integrity` digests
are placeholder `sha256:000...` values (as the fixture's are) because there
is no resolver in this workspace to compute real ones; when `gala resolve`
(or an equivalent) exists, this lockfile should be regenerated by that
command instead of hand-edited.

## Verifying

```sh
nvm use 24.18.0
node .user-template/scripts/verify-user-template.mjs
```

Resolves the `schema` and `publish` sibling checkouts the same way
`publish-action` resolves its own siblings: `WORKSPACE_ROOT` env var if set,
otherwise the fixed relative default (this user template living at `v2/user-template/`,
siblings at `v2/schema/` and `v2/publish/`).
