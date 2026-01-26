/**
 * Centralized constants for the application.
 * 
 * This file eliminates magic numbers and strings scattered throughout the codebase,
 * ensuring consistency and making it easier to adjust values in one place.
 */

// =============================================================================
// TIMEOUTS & DURATIONS
// =============================================================================

/**
 * Maximum duration for API routes (in seconds).
 * 
 * NOTE: Next.js segment configuration (export const maxDuration) requires
 * literal values, so route files must use `300` directly. This constant
 * serves as the source of truth for documentation and client-side code.
 * When changing this, search for "maxDuration = 300" to update route files.
 * 
 * Keep FETCH_TIMEOUT_MS in sync with this value.
 */
export const API_MAX_DURATION_SECONDS = 300

/**
 * Client-side fetch timeout (in milliseconds).
 * Should match API_MAX_DURATION_SECONDS to prevent client timeouts before server.
 */
export const FETCH_TIMEOUT_MS = API_MAX_DURATION_SECONDS * 1000

/**
 * Timeout for marking animation captures as "stuck" (in minutes).
 * Should be greater than API_MAX_DURATION_SECONDS/60 to allow for processing buffer.
 * 
 * Formula: (API_MAX_DURATION_SECONDS / 60) + 5 minute buffer = 10 minutes
 */
export const STUCK_CAPTURE_TIMEOUT_MINUTES = 10

// =============================================================================
// POLLING CONFIGURATION
// =============================================================================

/**
 * Interval between polling requests for animation capture status.
 */
export const CAPTURE_POLL_INTERVAL_MS = 2500

/**
 * Maximum number of poll attempts before giving up.
 * Total wait time: CAPTURE_POLL_INTERVAL_MS * CAPTURE_MAX_POLL_ATTEMPTS = 2.5 minutes
 */
export const CAPTURE_MAX_POLL_ATTEMPTS = 60

// =============================================================================
// ANIMATION CAPTURE
// =============================================================================

/**
 * Default number of frames to capture for animations.
 * At 6 seconds duration, this gives ~5fps which is sufficient for animation analysis.
 */
export const DEFAULT_CAPTURE_FRAME_COUNT = 30

/**
 * Default animation capture duration in milliseconds.
 */
export const DEFAULT_CAPTURE_DURATION_MS = 6000

// =============================================================================
// AUTO-SAVE & RETRY THRESHOLDS
// =============================================================================

/**
 * Debounce delay for auto-save after user changes (in milliseconds).
 */
export const AUTOSAVE_DEBOUNCE_MS = 1500

/**
 * Number of consecutive save failures before showing a warning toast.
 */
export const SAVE_FAILURE_WARN_THRESHOLD = 3

/**
 * Interval of consecutive failures at which to show reminder toasts.
 * After initial warning, remind user every N failures.
 */
export const SAVE_FAILURE_REMINDER_INTERVAL = 10

// =============================================================================
// DATA LIMITS
// =============================================================================

/**
 * Maximum length for user-provided prompts (characters).
 */
export const MAX_PROMPT_LENGTH = 50000

/**
 * Maximum length for node labels (characters).
 */
export const MAX_LABEL_LENGTH = 255

/**
 * Maximum length for code content (characters).
 */
export const MAX_CODE_LENGTH = 500000

/**
 * Maximum length for image URLs (characters).
 */
export const MAX_IMAGE_URL_LENGTH = 10000

/**
 * Maximum length for model identifiers (characters).
 */
export const MAX_MODEL_ID_LENGTH = 100

/**
 * Maximum length for language identifiers (characters).
 */
export const MAX_LANGUAGE_ID_LENGTH = 50

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default AI model for image generation.
 * Must match first option in prompt-node.tsx IMAGE_GEN_MODELS.
 */
export const DEFAULT_IMAGE_MODEL = "google/gemini-3-pro-image"

/**
 * Default edge type for workflow connections.
 */
export const DEFAULT_EDGE_TYPE = "curved" as const

// =============================================================================
// POSTGRES ERROR CODES
// =============================================================================

/**
 * PostgREST error code for "No rows returned".
 * Used when a query expects a single row but finds none (e.g., .single() on empty result).
 */
export const PGRST_NO_ROWS_CODE = "PGRST116"
