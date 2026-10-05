import '@testing-library/jest-dom';

/**
 * Node 22+ ships experimental Web Storage globals. Without
 * --localstorage-file they read as undefined, and they shadow the working
 * jsdom ones the tests are written against. Point them back at jsdom's.
 * On a Node without them (CI runs Node 20) this does nothing.
 */
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (typeof globalThis[name] === 'undefined' && dom) {
    Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true, writable: true });
  }
}
