import { cx } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import React from "react"

// Centralized loading spinner component
export function LoadingSpinner({
    size = "default",
    className
}: {
    size?: "sm" | "default" | "lg"
    className?: string
}) {
    const sizeClasses = {
        sm: "h-4 w-4",
        default: "h-6 w-6",
        lg: "h-8 w-8"
    }

    return (
        <Loader2
            className={cx("animate-spin text-blue-500", sizeClasses[size], className)}
        />
    )
}

// Page-level loading component
export function PageLoading({ message = "Loading..." }: { message?: string }) {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" />
                <span className="text-lg text-gray-700 dark:text-gray-200">{message}</span>
            </div>
        </div>
    )
}

// Chart skeleton loading
export function ChartSkeleton({ className }: { className?: string }) {
    return (
        <div className={cx("w-full", className)}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                    <div className="h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-4 w-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>
            </div>
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800 mb-4" />
            <div className="h-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
    )
}

// Table skeleton loading
export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
    return (
        <div className="space-y-3">
            {/* Header skeleton */}
            <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                {Array.from({ length: columns }).map((_, i) => (
                    <div key={i} className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                ))}
            </div>

            {/* Rows skeleton */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex space-x-4 py-2">
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <div key={colIndex} className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    ))}
                </div>
            ))}
        </div>
    )
}

// Card skeleton loading
export function CardSkeleton({ className }: { className?: string }) {
    return (
        <div className={cx("p-6 border rounded-lg", className)}>
            <div className="space-y-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-6 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                <div className="space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>
            </div>
        </div>
    )
}

// Inline loading component for buttons/actions
export function InlineLoading({
    text = "Loading...",
    size = "sm"
}: {
    text?: string
    size?: "sm" | "default"
}) {
    return (
        <div className="flex items-center gap-2">
            <LoadingSpinner size={size} />
            <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>
        </div>
    )
}

// Progressive data loading component
export function ProgressiveLoader({
    isLoading,
    hasData,
    children,
    skeleton,
    emptyMessage = "No data available"
}: {
    isLoading: boolean
    hasData: boolean
    children: React.ReactNode
    skeleton: React.ReactNode
    emptyMessage?: string
}) {
    if (isLoading) {
        return <>{skeleton}</>
    }

    if (!hasData) {
        return (
            <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                {emptyMessage}
            </div>
        )
    }

    return <>{children}</>
}