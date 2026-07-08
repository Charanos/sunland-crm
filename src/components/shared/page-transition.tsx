"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function PageTransition({ children, className = "", delay = 0 }: PageTransitionProps) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!container.current) return;

    // A subtle mix: slight vertical shift and fade-in
    gsap.fromTo(
      container.current,
      { 
        y: 12, 
        opacity: 0,
        scale: 0.99
      },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.6,
        delay: delay,
        ease: "power2.out",
        clearProps: "all" // Clears GSAP styles after animation to prevent conflicts
      }
    );

    // Stagger inner children slightly if they have a specific data attribute or we can just animate the container 
    // for a smooth overall entry. The user wanted a mix without being overwhelming.
    
    // Select immediate children cards/panels for a very subtle stagger
    const panels = container.current.querySelectorAll('.gsap-stagger');
    if (panels.length > 0) {
      gsap.fromTo(
        panels,
        { opacity: 0, y: 15 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.08,
          delay: delay + 0.1,
          ease: "power2.out",
          clearProps: "all"
        }
      );
    }

  }, { scope: container });

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
}
