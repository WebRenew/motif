/**
 * Structured logger for server-side observability
 * Outputs JSON logs that work well with Vercel's log ingestion
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  service?: string
  requestId?: string
  userId?: string
  duration?: number
  [key: string]: unknown
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }
  return JSON.stringify(entry)
}

export function createLogger(service: string) {
  return {
    debug: (message: string, context?: LogContext) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(formatLog('debug', message, { service, ...context }))
      }
    },
    info: (message: string, context?: LogContext) => {
      console.log(formatLog('info', message, { service, ...context }))
    },
    warn: (message: string, context?: LogContext) => {
      console.warn(formatLog('warn', message, { service, ...context }))
    },
    error: (message: string, context?: LogContext) => {
      console.error(formatLog('error', message, { service, ...context }))
    },
  }
}

/**
 * Timer utility for measuring durations
 */
export function startTimer() {
  const start = performance.now()
  return {
    elapsed: () => Math.round(performance.now() - start),
    elapsedSeconds: () => ((performance.now() - start) / 1000).toFixed(2),
  }
}

/**
 * Generate a short request ID for tracing
 */
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10)
}
