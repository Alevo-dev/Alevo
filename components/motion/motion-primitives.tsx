"use client";

import { type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  type Variants,
  type Transition,
} from "motion/react";

/** Warm, organic spring — gentle, never snappy-robotic. */
export const softSpring: Transition = {
  type: "spring",
  stiffness: 120,
  damping: 20,
  mass: 0.9,
};

const easeOut: Transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] };

type FadeInProps = {
  children: ReactNode;
  className?: string;
  /** Slide-in direction. */
  from?: "up" | "down" | "left" | "right" | "none";
  delay?: number;
  once?: boolean;
};

const OFFSET = 22;

export function FadeIn({
  children,
  className,
  from = "up",
  delay = 0,
  once = true,
}: FadeInProps) {
  const reduce = useReducedMotion();

  const offset =
    from === "none"
      ? {}
      : {
          x: from === "left" ? -OFFSET : from === "right" ? OFFSET : 0,
          y: from === "up" ? OFFSET : from === "down" ? -OFFSET : 0,
        };

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, ...offset }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={{ ...easeOut, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Container that staggers its <Stagger.Item> children into view. */
const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

const staggerItemReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

export function Stagger({
  children,
  className,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={reduce ? staggerItemReduced : staggerItem}
    >
      {children}
    </motion.div>
  );
}
