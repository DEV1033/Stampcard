import * as React from "react";
import { animate, motion, useMotionTemplate, useMotionValue, useTransform } from "framer-motion";
import type { AnimationPlaybackControls } from "framer-motion";
import { Trash2 } from "lucide-react";
import clsx from "clsx";

export type HoldToDeleteButtonProps = {
  onComplete: () => void;
  /** Seconds the button must be held. */
  holdDuration?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Press and hold to confirm a destructive action. A light red fill sweeps
 * left → right while held; the covered part of the label turns red. Letting
 * go early drains the fill back. Works with mouse, touch and keyboard
 * (hold Space or Enter).
 */
export default function HoldToDeleteButton({
  onComplete,
  holdDuration = 1.2,
  label = "Hold to Delete",
  disabled = false,
  className,
}: HoldToDeleteButtonProps) {
  const progress = useMotionValue(0);
  const controls = React.useRef<AnimationPlaybackControls | null>(null);
  const completed = React.useRef(false);

  // Reveal the red layer from the left as progress grows.
  const hidden = useTransform(progress, (p) => (1 - p) * 100);
  const clipPath = useMotionTemplate`inset(0 ${hidden}% 0 0)`;

  const start = () => {
    if (disabled || completed.current) return;
    controls.current?.stop();
    controls.current = animate(progress, 1, {
      duration: (1 - progress.get()) * holdDuration,
      ease: "linear",
      onComplete: () => {
        completed.current = true;
        onComplete();
      },
    });
  };

  const cancel = () => {
    if (completed.current) return;
    controls.current?.stop();
    controls.current = animate(progress, 0, { duration: 0.35, ease: [0.4, 0, 0.2, 1] });
  };

  React.useEffect(() => () => controls.current?.stop(), []);

  const content = (
    <>
      <Trash2 className="size-[18px] shrink-0" strokeWidth={2} />
      <span>{label}</span>
    </>
  );

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") cancel();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={clsx(
        "relative isolate select-none overflow-hidden rounded-full bg-neutral-100 touch-none",
        "text-[15px] font-semibold text-neutral-900",
        "outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {/* Base layer */}
      <span className="flex items-center justify-center gap-2.5 px-6 py-3">{content}</span>
      {/* Red layer, revealed left → right while held */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center gap-2.5 bg-red-100 px-6 py-3 text-red-500"
        style={{ clipPath }}
      >
        {content}
      </motion.span>
    </button>
  );
}
