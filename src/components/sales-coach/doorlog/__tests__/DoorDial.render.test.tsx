// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DoorDial } from "../DoorDial";

/**
 * DoorDial — tap logs one, long-press decrements one (Q5), and a long-press must NOT also fire a tap.
 * These pin the gesture split (the behaviour a bare onClick would get wrong).
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe("DoorDial gestures", () => {
  it("a quick press fires onTap once, not onDecrement", () => {
    const onTap = vi.fn(); const onDecrement = vi.fn();
    render(<DoorDial count={3} target={80} label="Doors" onTap={onTap} onDecrement={onDecrement} />);
    const btn = screen.getByRole("button");
    fireEvent.pointerDown(btn);
    vi.advanceTimersByTime(100); // well under the long-press threshold
    fireEvent.pointerUp(btn);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onDecrement).not.toHaveBeenCalled();
  });

  it("a long press fires onDecrement and suppresses the tap", () => {
    const onTap = vi.fn(); const onDecrement = vi.fn();
    render(<DoorDial count={3} target={80} label="Doors" onTap={onTap} onDecrement={onDecrement} />);
    const btn = screen.getByRole("button");
    fireEvent.pointerDown(btn);
    vi.advanceTimersByTime(500); // past the long-press threshold
    fireEvent.pointerUp(btn);
    expect(onDecrement).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled(); // the long-press already handled it
  });

  it("a horizontal DRAG suppresses the tap (swipe the pager, don't log)", () => {
    const onTap = vi.fn();
    render(<DoorDial count={3} target={80} label="Doors" onTap={onTap} />);
    const btn = screen.getByRole("button");
    fireEvent.pointerDown(btn, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(btn, { clientX: 40, clientY: 2 }); // past the drag tolerance
    fireEvent.pointerUp(btn, { clientX: 40, clientY: 2 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it("a tiny jitter within tolerance still counts as a tap", () => {
    const onTap = vi.fn();
    render(<DoorDial count={3} target={80} label="Doors" onTap={onTap} />);
    const btn = screen.getByRole("button");
    fireEvent.pointerDown(btn, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(btn, { clientX: 8, clientY: 6 }); // < 10px, still a tap
    fireEvent.pointerUp(btn, { clientX: 8, clientY: 6 });
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("leaving before release cancels (no tap, no decrement)", () => {
    const onTap = vi.fn(); const onDecrement = vi.fn();
    render(<DoorDial count={3} target={80} label="Doors" onTap={onTap} onDecrement={onDecrement} />);
    const btn = screen.getByRole("button");
    fireEvent.pointerDown(btn);
    fireEvent.pointerLeave(btn);
    vi.advanceTimersByTime(500);
    expect(onTap).not.toHaveBeenCalled();
    expect(onDecrement).not.toHaveBeenCalled();
  });
});
