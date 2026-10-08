export function DealCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="aspect-[4/3] bg-gray-200 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
        <div className="flex items-center gap-2">
          <div className="h-5 bg-gray-200 rounded animate-pulse w-16" />
          <div className="h-5 bg-gray-200 rounded animate-pulse w-12" />
        </div>
      </div>
    </div>
  );
}

export function SearchResultsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <DealCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HomepageSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 bg-gray-200 rounded animate-pulse w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <DealCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
