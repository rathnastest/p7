#!/usr/bin/env node
/**
 * Verifies this user template repository the same way Galascribe verifies any
 * generated publication repository: every Gala document schema-valid,
 * every content file's frontmatter schema-valid and initially publishable,
 * the real `@rathnasgala2/publish-action` admitting those starters in a
 * production publish, and the caller workflow byte-identical to
 * `publish`'s published contract.
 *
 * This file lives under `.user-template/` together with `USER-TEMPLATE.md` because it
 * is workspace-development tooling, not something a person's generated
 * publication repository needs to write an article. Galascribe deletes
 * `.user-template/` in the identity commit it makes right after generating a
 * repository from this user template.
 *
 * Sibling repositories (`schema`, `publish`) are resolved the same way
 * `publish-action` itself resolves its own siblings (`template`,
 * `theme-*`): `WORKSPACE_ROOT` when set, otherwise the fixed relative
 * default from this file's own location.
 *
 * @module
 */

import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const THIS_FILE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
// .user-template/scripts/ -> .user-template/ -> <repository root> -> v2/
const DEFAULT_RELATIVE_WORKSPACE_ROOT = '../../../';

function resolveWorkspaceRoot() {
  const override = process.env.WORKSPACE_ROOT;
  if (override && override.length > 0) {
    return path.resolve(override);
  }
  return path.resolve(THIS_FILE_DIRECTORY, DEFAULT_RELATIVE_WORKSPACE_ROOT);
}

const workspaceRoot = resolveWorkspaceRoot();
const repositoryDirectory = path.resolve(THIS_FILE_DIRECTORY, '../../');
const schemaRoot = path.join(workspaceRoot, 'schema');
const publishRoot = path.join(workspaceRoot, 'publish');
const publishActionRoot = path.join(
  publishRoot,
  'packages',
  'publish-action',
);

/** @type {string[]} */
const failures = [];

function report(label, ok, detail) {
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

async function main() {
  console.log(`workspace root: ${workspaceRoot}`);
  console.log(`repository:     ${repositoryDirectory}`);

  const { validateGalaDocument } = await import(
    pathToFileURL(path.join(schemaRoot, 'src', 'index.js')).href
  );

  // 1. Schema-validate every Gala document.
  const documents = [
    ['urn:gala:schema:repository:2.0.0', 'gala/repository.json'],
    ['urn:gala:schema:publication:2.0.0', 'gala/publication.json'],
    ['urn:gala:schema:navigation:2.0.0', 'gala/navigation.json'],
    ['urn:gala:schema:appearance:2.0.0', 'gala/appearance.json'],
    ['urn:gala:schema:lock:2.0.0', 'gala.lock.json'],
  ];
  const authorFiles = await readdir(
    path.join(repositoryDirectory, 'gala', 'authors'),
  );
  for (const name of authorFiles.filter((f) => f.endsWith('.json'))) {
    documents.push(['urn:gala:schema:author:2.0.0', `gala/authors/${name}`]);
  }
  for (const [schemaId, relativePath] of documents) {
    const value = JSON.parse(
      await readFile(path.join(repositoryDirectory, relativePath), 'utf8'),
    );
    const result = validateGalaDocument(schemaId, value);
    report(
      `schema: ${relativePath}`,
      Boolean(result.valid),
      result.valid ? undefined : JSON.stringify(result.diagnostics),
    );
  }

  const lock = JSON.parse(
    await readFile(path.join(repositoryDirectory, 'gala.lock.json'), 'utf8'),
  );
  const selectedAdapters = lock.publisher.filter((entry) =>
    /^@rathnasgala2\/adapter-(?:local-directory|github-pages|do-spaces)$/u.test(
      entry.package,
    ),
  );
  report(
    'lock selects exactly GitHub Pages adapter 0.1.1',
    selectedAdapters.length === 1 &&
      selectedAdapters[0].package === '@rathnasgala2/adapter-github-pages' &&
      selectedAdapters[0].version === '0.1.1',
    JSON.stringify(selectedAdapters),
  );

  // 2. Schema-validate every content file's frontmatter.
  const require = createRequire(
    pathToFileURL(path.join(publishActionRoot, 'package.json')).href,
  );
  const YAML = require('yaml');
  const contentFiles = (
    await readdir(path.join(repositoryDirectory, 'content'))
  ).filter((f) => f.endsWith('.md'));
  for (const name of contentFiles) {
    const text = await readFile(
      path.join(repositoryDirectory, 'content', name),
      'utf8',
    );
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) {
      report(`frontmatter: content/${name}`, false, 'no frontmatter fence found');
      continue;
    }
    const frontmatter = YAML.parse(match[1]);
    const result = validateGalaDocument(
      'urn:gala:schema:content-frontmatter:2.0.0',
      frontmatter,
    );
    report(
      `frontmatter: content/${name}`,
      Boolean(result.valid),
      result.valid ? undefined : JSON.stringify(result.diagnostics),
    );
    report(
      `starter state: content/${name}`,
      frontmatter.status === 'published' &&
        typeof frontmatter.publishedAt === 'string',
      `status=${String(frontmatter.status)} publishedAt=${String(frontmatter.publishedAt)}`,
    );
  }

  // 3. Publish normalization must admit every starter. A generated repository
  // that contains only these files must be publishable without a hidden
  // visibility edit first.
  const { buildBuildInputFromRepository } = await import(
    pathToFileURL(
      path.join(
        publishActionRoot,
        'src',
        'normalize',
        'repository-intake.js',
      ),
    ).href
  );
  const publishInput = await buildBuildInputFromRepository({
    repositoryDirectory,
    includeDraftsAsUnlisted: false,
  });
  const publishContent = /** @type {{frontmatter?: {status?: string}}[]} */ (
    publishInput.content
  );
  report(
    'publish-action includes every published starter in a production publish',
    publishContent.length === contentFiles.length &&
      publishContent.every((item) => item.frontmatter?.status === 'published'),
    JSON.stringify(publishContent.map((item) => item.frontmatter?.status)),
  );

  // 4. The caller workflow must be byte-identical to publish's own contract.
  const callerPath = path.join(
    repositoryDirectory,
    '.github',
    'workflows',
    'gala-publish-v2.yml',
  );
  const contractPath = path.join(
    publishRoot,
    'docs',
    'callers',
    'gala-publish-v2.yml',
  );
  const [callerBytes, contractBytes] = await Promise.all([
    readFile(callerPath),
    readFile(contractPath),
  ]);
  const digest = (buf) => createHash('sha256').update(buf).digest('hex');
  report(
    'caller workflow byte-identical to publish/docs/callers/gala-publish-v2.yml',
    digest(callerBytes) === digest(contractBytes),
    `${digest(callerBytes)} vs ${digest(contractBytes)}`,
  );
  const callerPin = callerBytes
    .toString('utf8')
    .match(/rathnasgala2\/publish\/\.github\/workflows\/publish-v2\.yml@([0-9a-f]{40})/)?.[1];
  const templateGuide = await readFile(
    path.join(repositoryDirectory, '.user-template', 'USER-TEMPLATE.md'),
    'utf8',
  );
  report(
    'USER-TEMPLATE.md documents the caller workflow pin',
    callerPin !== undefined && templateGuide.includes(`\`${callerPin}\``),
    callerPin,
  );

  console.log('');
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('All checks passed.');
  }
}

main().catch((error) => {
  console.error(error.stack ?? String(error));
  process.exitCode = 1;
});
