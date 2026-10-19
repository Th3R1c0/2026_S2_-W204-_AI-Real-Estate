import "@testing-library/jest-dom/vitest";

// jsdom does not supply the layout-observation APIs used by shadcn's carousel/scroller.
if (typeof window !== "undefined" && !window.matchMedia)
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
  });
if (!globalThis.ResizeObserver)
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
if (!globalThis.IntersectionObserver)
  globalThis.IntersectionObserver = class {
    root = null;
    rootMargin = "";
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.scrollTo)
  HTMLElement.prototype.scrollTo = function () {};
