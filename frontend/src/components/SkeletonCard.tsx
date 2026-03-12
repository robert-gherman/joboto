export default function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg animate-shimmer flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 rounded-md animate-shimmer" />
          <div className="h-4 w-1/2 rounded-md animate-shimmer" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-16 rounded-full animate-shimmer" />
        <div className="h-6 w-20 rounded-full animate-shimmer" />
        <div className="h-6 w-14 rounded-full animate-shimmer" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded animate-shimmer" />
        <div className="h-3 w-5/6 rounded animate-shimmer" />
      </div>
      <div className="flex justify-between items-center pt-2">
        <div className="h-4 w-24 rounded animate-shimmer" />
        <div className="h-4 w-16 rounded animate-shimmer" />
      </div>
    </div>
  );
}
