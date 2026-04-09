function LoadingSkeleton({ className = 'h-8 w-full' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

export default LoadingSkeleton;
