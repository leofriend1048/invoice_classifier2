export default function Loading() {
    return (
        <div className="space-y-6">
            <div className="h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />

            {/* Gmail status card skeleton */}
            <div className="border rounded-lg p-6 space-y-4">
                <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-8 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Users table skeleton */}
            <div className="border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-8 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>

                {/* Table header */}
                <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    ))}
                </div>

                {/* Table rows */}
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex space-x-4 py-2">
                        {Array.from({ length: 4 }).map((_, colIndex) => (
                            <div key={colIndex} className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}