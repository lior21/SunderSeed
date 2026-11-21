import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

/**
 * Renders the app to static HTML at build time.
 *
 * The output is injected into <div id="root"> in dist/index.html so that
 * crawlers (and no-JS visitors) see the real page content instead of an
 * empty container. At runtime `createRoot().render()` replaces this markup,
 * so there is no hydration step and no mismatch risk.
 */
export function prerender(): string {
  return renderToStaticMarkup(<App />);
}
