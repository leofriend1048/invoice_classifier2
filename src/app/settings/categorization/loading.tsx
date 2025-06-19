export default function Loading() {
    return (
        <div className="space-y-6">
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />

            {/* Settings form skeleton */}
            <div className="border rounded-lg p-6 space-y-6">
                <div className="space-y-4">
                    <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>

                <div className="space-y-4">
                    <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-20 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>

                <div className="space-y-4">
                    <div className="h-4 w-36 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>

                <div className="flex justify-end">
                    <div className="h-8 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>
            </div>
        </div>
    )
}