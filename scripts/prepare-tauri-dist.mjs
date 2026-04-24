import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const nextDir = path.join(rootDir, '.next');
const appOutputDir = path.join(nextDir, 'server', 'app');
const staticDir = path.join(nextDir, 'static');
const publicDir = path.join(rootDir, 'public');
const tauriIconPath = path.join(rootDir, 'src-tauri', 'icons', 'icon.ico');
const distDir = path.join(rootDir, 'dist');

function routeFromHtmlFilename(filename) {
  if (filename === 'index.html') {
    return ['index.html'];
  }

  if (filename === '_not-found.html') {
    return ['404.html'];
  }

  if (filename.startsWith('_')) {
    return null;
  }

  return [filename.replace(/\.html$/, ''), 'index.html'];
}

async function copyDirectoryIfPresent(sourceDir, destinationDir) {
  try {
    await stat(sourceDir);
  } catch {
    return;
  }

  await cp(sourceDir, destinationDir, { recursive: true });
}

async function copyRenderedRoutes() {
  const entries = await readdir(appOutputDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) {
      continue;
    }

    const relativeTarget = routeFromHtmlFilename(entry.name);
    if (!relativeTarget) {
      continue;
    }

    const sourceFile = path.join(appOutputDir, entry.name);
    const destinationFile = path.join(distDir, ...relativeTarget);

    await mkdir(path.dirname(destinationFile), { recursive: true });

    let contents = await readFile(sourceFile, 'utf8');

    // Tauri serves our packaged assets from the app root, so keep the generated
    // absolute asset paths but make sure the fallback favicon exists in dist.
    contents = contents.replaceAll('/favicon.ico?603d046c9a6fdfbb', '/favicon.ico');

    await writeFile(destinationFile, contents);
  }
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await copyRenderedRoutes();
  await copyDirectoryIfPresent(staticDir, path.join(distDir, '_next', 'static'));
  await copyDirectoryIfPresent(publicDir, distDir);
  await cp(tauriIconPath, path.join(distDir, 'favicon.ico'));
}

await main();
