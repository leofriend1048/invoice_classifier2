export default function Loading() {
    return (
        <div className="space-y-6">
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />

            <div className="space-y-3">
                {/* Filter bar skeleton */}
                <div className="flex items-center justify-between">
                    <div className="h-8 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="flex space-x-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-8 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                        ))}
                    </div>
                </div>

                {/* Table header skeleton */}
                <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    ))}
                </div>

                {/* Table rows skeleton */}
                {Array.from({ length: 8 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex space-x-4 py-3">
                        {Array.from({ length: 8 }).map((_, colIndex) => (
                            <div key={colIndex} className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                        ))}
                    </div>
                ))}

                {/* Pagination skeleton */}
                <div className="flex items-center justify-between pt-4">
                    <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="flex space-x-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-8 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}