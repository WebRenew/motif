/**
 * Outlet icon component
 * Source: tabler:outlet (modified stroke-width: 1.75px)
 */
"use client"

import { useState, useEffect, useRef, type SVGProps } from "react";

interface OutletIconProps extends SVGProps<SVGSVGElement> {
  /** Enable eye tracking - eyes follow mouse cursor */
  animated?: boolean;
}

export function OutletIcon({ className, animated = false, ...props }: OutletIconProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!animated) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate direction to mouse
      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      // Normalize and limit movement (max 1.5px offset in SVG coords)
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxOffset = 1.5;
      
      if (distance > 0) {
        const scale = Math.min(distance / 100, 1); // Smooth scaling based on distance
        setEyeOffset({
          x: (deltaX / distance) * maxOffset * scale,
          y: (deltaY / distance) * maxOffset * scale,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [animated]);

  // Static version (default)
  if (!animated) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className={className}
        {...props}
      >
        <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />
        <circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  // Animated version with eye tracking
  const leftEyeX = 9 + eyeOffset.x;
  const leftEyeY = 12 + eyeOffset.y;
  const rightEyeX = 15 + eyeOffset.x;
  const rightEyeY = 12 + eyeOffset.y;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />
      <circle 
        cx={leftEyeX} 
        cy={leftEyeY} 
        r="1.1" 
        fill="currentColor" 
        stroke="none"
        style={{ transition: "cx 0.1s ease-out, cy 0.1s ease-out" }}
      />
      <circle 
        cx={rightEyeX} 
        cy={rightEyeY} 
        r="1.1" 
        fill="currentColor" 
        stroke="none"
        style={{ transition: "cx 0.1s ease-out, cy 0.1s ease-out" }}
      />
    </svg>
  );
}
