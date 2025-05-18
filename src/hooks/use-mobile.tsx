
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // TEMPORARY DEBUGGING: Return a constant value to test if isMobile state changes are causing a loop.
    // In a real scenario, investigate why window.innerWidth or media query changes might be firing excessively.
    setIsMobile(false); // Forcing to desktop view for testing
    return; // Bypassing the event listener for now

    // Original logic:
    // const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    // const onChange = () => {
    //   setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    // }
    // mql.addEventListener("change", onChange)
    // setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    // return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
