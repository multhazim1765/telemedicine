import { Variants } from "framer-motion";

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeIn" } }
};

export const cardHoverMotion = {
  whileHover: { y: -4, scale: 1.01 },
  transition: { duration: 0.22 }
};

export const sidebarMotion: Variants = {
  open: { width: 256, transition: { duration: 0.3 } },
  closed: { width: 80, transition: { duration: 0.3 } }
};

export const modalMotion: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, scale: 0.96, y: 6, transition: { duration: 0.2 } }
};
