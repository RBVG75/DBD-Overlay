import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PERK_DIRECTORIES = {
  killer: 'perks_killers',
  survivor: 'perks-survis',
};
const PERK_VIRTUAL_ID = 'virtual:perk-assets';
const PERK_RESOLVED_ID = `\0${PERK_VIRTUAL_ID}`;

function perkSlug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function perkLabelFromFilename(filename) {
  const stem = filename
    .replace(/\.[^.]+$/, '')
    .replace(/^icons?perks[_-]?/i, '');
  const spaced = stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readPerkAssets() {
  const metadataPath = path.join(ROOT, 'src', 'data', 'perks.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const preferredLabels = new Map();
  for (const name of [...(metadata.labelOverrides?.killer || []), ...(metadata.labelOverrides?.survivor || [])]) {
    preferredLabels.set(perkSlug(name), name);
  }
  for (const [id, name] of Object.entries(metadata.displayNames || {})) preferredLabels.set(id, name);
  const records = new Map();
  const aliases = metadata.fileAliases || {};

  for (const [role, directory] of Object.entries(PERK_DIRECTORIES)) {
    const absoluteDirectory = path.join(ROOT, 'images', directory);
    const files = fs.readdirSync(absoluteDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(png|webp)$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    for (const filename of files) {
      const rawStem = filename.replace(/\.[^.]+$/, '').replace(/^icons?perks[_-]?/i, '');
      const rawId = perkSlug(rawStem);
      const id = aliases[rawId] || rawId;
      if (!id) continue;
      const image = `/${directory}/${filename}`;
      let item = records.get(id);
      if (!item) {
        item = {
          id,
          name: preferredLabels.get(id) || perkLabelFromFilename(filename),
          roles: [],
          image,
          aliases: [],
          imageScore: Infinity,
        };
        records.set(id, item);
      }
      if (!item.roles.includes(role)) item.roles.push(role);
      if (!item.aliases.includes(image)) item.aliases.push(image);

      // Prefer the current, descriptive asset filename over legacy IconPerks aliases.
      const legacyPrefix = /^icons?perks[_-]?/i.test(filename) ? 1 : 0;
      const webpPreference = /\.webp$/i.test(filename) ? -0.1 : 0;
      const score = legacyPrefix + webpPreference;
      if (score < item.imageScore) {
        item.image = image;
        item.imageScore = score;
      }
      if (preferredLabels.has(id)) item.name = preferredLabels.get(id);
    }
  }

  const all = [...records.values()]
    .map(({ imageScore, ...item }) => ({ ...item, aliases: item.aliases.sort() }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  const missingLabelAssets = [];
  for (const role of Object.keys(PERK_DIRECTORIES)) {
    for (const name of metadata.labelOverrides?.[role] || []) {
      const rawId = perkSlug(name);
      const id = aliases[rawId] || rawId;
      if (!records.has(id)) missingLabelAssets.push(`${role}: ${name}`);
    }
  }
  if (missingLabelAssets.length) throw new Error(`Perks antiguas sin imagen equivalente: ${missingLabelAssets.join(', ')}`);
  return {
    all,
    killer: all.filter((item) => item.roles.includes('killer')),
    survivor: all.filter((item) => item.roles.includes('survivor')),
    byKiller: metadata.byKiller || {},
  };
}

function perkAssetCatalogPlugin() {
  return {
    name: 'perk-asset-catalog',
    resolveId(id) {
      if (id === PERK_VIRTUAL_ID) return PERK_RESOLVED_ID;
    },
    load(id) {
      if (id !== PERK_RESOLVED_ID) return null;
      const catalog = readPerkAssets();
      return `export const PERK_ASSETS = ${JSON.stringify(catalog)};`;
    },
    configureServer(server) {
      const directories = Object.values(PERK_DIRECTORIES).map((directory) => path.join(ROOT, 'images', directory));
      server.watcher.add(directories);
      server.watcher.on('all', (event, filename) => {
        if (!['add', 'unlink', 'change'].includes(event)) return;
        if (!directories.some((directory) => filename.startsWith(directory))) return;
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  root: 'src',
  // Character portraits and icons live outside `src`, so point Vite's static
  // asset folder at them: `images/killers/x.webp` is served as `/killers/x.webp`
  // in dev and copied to `dist/` on build.
  publicDir: '../images',
  plugins: [perkAssetCatalogPlugin()],
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
