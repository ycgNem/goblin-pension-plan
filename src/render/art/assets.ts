// Every packed PNG under src/assets/art/, decoded once at boot. Vite hashes the files and keeps
// their URLs relative, so this works under the GitHub Pages base path too.

const URLS = import.meta.glob<string>('../../assets/art/*.png', { eager: true, query: '?url', import: 'default' });

const images = new Map<string, HTMLImageElement>();

/**
 * Load all the art. Anything that fails to load is left out, and its drawing falls back to code.
 * Uses load events rather than decode(), which never settles in a page that isn't painting.
 */
export async function loadArt(): Promise<void> {
  await Promise.all(
    Object.entries(URLS).map(
      ([path, url]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            images.set(path.slice(path.lastIndexOf('/') + 1), img);
            resolve();
          };
          // Missing or broken: the code-drawn art stands in.
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  );
}

/** A decoded image by file name, or undefined if it isn't loaded (or this is a test run). */
export function artImage(file: string): HTMLImageElement | undefined {
  return images.get(file);
}
