import { 
  ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND, 
  ORIGINAL_LIFECYCLE_BACKEND,
  deriveBackendRef 
} from "./lifecycle-deployment-observation";

/** 
 * Explicit isolated-only opt-in. Never authorizes a user or opens production.
 * This gate ensures that lifecycle mutations only happen in the approved 
 * isolated environment and never in the original production backend.
 */
export function lifecycleAcceptanceEnabled(url: string | undefined, enabled: string | undefined) {
  if (enabled !== "isolated-accepted") return false;
  
  const currentRef = deriveBackendRef(url);
  if (!currentRef) return false;
  
  // Refuse if it's the original backend
  if (currentRef === ORIGINAL_LIFECYCLE_BACKEND) return false;
  
  // Only permit the approved isolated backend
  if (currentRef !== ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND) return false;

  try {
    const parsed = new URL(url ?? "");
    // Maintain strict URL properties for additional safety
    return parsed.protocol === "https:" && 
           !parsed.username && 
           !parsed.password && 
           (parsed.pathname === "/" || parsed.pathname === "") && 
           !parsed.search && 
           !parsed.hash;
  } catch { 
    return false; 
  }
}
