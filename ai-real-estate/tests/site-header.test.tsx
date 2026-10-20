import { render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PropertyExplorer from "../app/components/property-explorer";
import { properties } from "../lib/property-data";

const route = vi.hoisted(() => ({ pathname: null as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

afterEach(() => {
  vi.unstubAllGlobals();
  route.pathname = null;
  window.history.replaceState(null, "", "/");
});

it("marks Discover as current on the homepage before pathname hydration", () => {
  render(
    <PropertyExplorer
      properties={properties.slice(0, 1)}
      comparableSales={[]}
    />,
  );
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(nav).getByRole("link", { name: "Discover" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

it.each(["/", "/properties/example-home"])(
  "activates Calculator while its section is visible on %s, then restores Discover",
  async (path) => {
    const { act } = await import("@testing-library/react");
    const { default: SiteHeader } =
      await import("../app/components/site-header");
    let notify: IntersectionObserverCallback | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private callback: IntersectionObserverCallback) {}
        observe(target: Element) {
          if (target.id === "calculator") notify = this.callback;
        }
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    route.pathname = path;
    window.history.replaceState(null, "", path);
    render(
      <>
        <SiteHeader currentPage={path === "/" ? "discover" : undefined} />
        <section id="calculator">Calculator content</section>
      </>,
    );
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    act(() =>
      notify?.(
        [
          {
            isIntersecting: true,
            target: document.getElementById("calculator")!,
            boundingClientRect: document
              .getElementById("calculator")!
              .getBoundingClientRect(),
            intersectionRect: document
              .getElementById("calculator")!
              .getBoundingClientRect(),
            rootBounds: null,
            intersectionRatio: 1,
            time: 0,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    );
    expect(
      within(nav).getByRole("link", { name: "Mortgage calculator" }),
    ).toHaveAttribute("aria-current", "location");
    expect(
      within(nav).getByRole("link", { name: "Discover" }),
    ).not.toHaveAttribute("aria-current");
    act(() =>
      notify?.(
        [
          {
            isIntersecting: false,
            target: document.getElementById("calculator")!,
            boundingClientRect: document
              .getElementById("calculator")!
              .getBoundingClientRect(),
            intersectionRect: document
              .getElementById("calculator")!
              .getBoundingClientRect(),
            rootBounds: null,
            intersectionRatio: 1,
            time: 0,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    );
    expect(within(nav).getByRole("link", { name: "Discover" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  },
);

it("jumps directly to the local calculator on mobile", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  const { default: SiteHeader } = await import("../app/components/site-header");
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  render(
    <>
      <SiteHeader currentPage="discover" />
      <section id="calculator">Calculator content</section>
    </>,
  );
  const scroll = vi.fn();
  document.getElementById("calculator")!.scrollIntoView = scroll;
  await user.click(screen.getByRole("link", { name: "Mortgage calculator" }));
  expect(scroll).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
  expect(
    screen.getByRole("link", { name: "Mortgage calculator" }),
  ).toHaveAttribute("aria-current", "location");
  vi.unstubAllGlobals();
});
