import { useEffect, useRef, useCallback } from "react";

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  edgeZoneLeft?: number;  // only trigger swipe-left from right edge
  edgeZoneRight?: number; // only trigger swipe-right from left edge
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 60,
  edgeZoneLeft,
  edgeZoneRight,
}: SwipeOptions) {
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    },
    []
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const elapsed = Date.now() - touchStart.current.time;

      // Must be mostly horizontal and fast enough
      if (Math.abs(dx) > threshold && Math.abs(dy) < Math.abs(dx) * 0.7 && elapsed < 500) {
        if (dx < 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }
      touchStart.current = null;
    },
    [onSwipeLeft, onSwipeRight, threshold]
  );

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);
}
