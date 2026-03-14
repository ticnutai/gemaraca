import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;
const SMALL_MOBILE_BREAKPOINT = 380;

/** Check if device supports touch (runs once) */
const isTouchDevice = typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean>(
    typeof window !== "undefined"
      ? window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_BREAKPOINT
      : false
  );

  React.useEffect(() => {
    const onChange = () => {
      const w = window.innerWidth;
      setIsTablet(w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT);
    };
    window.addEventListener("resize", onChange, { passive: true });
    onChange();
    return () => window.removeEventListener("resize", onChange);
  }, []);

  return isTablet;
}

export function useIsSmallMobile() {
  const [isSmall, setIsSmall] = React.useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < SMALL_MOBILE_BREAKPOINT : false
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SMALL_MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsSmall(window.innerWidth < SMALL_MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isSmall;
}

export function useIsTouch() {
  return isTouchDevice;
}

export type DeviceType = "small-mobile" | "mobile" | "tablet" | "desktop";

export function useDeviceType(): DeviceType {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isSmall = useIsSmallMobile();

  if (isSmall) return "small-mobile";
  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  return "desktop";
}
