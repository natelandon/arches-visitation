interface LoadingFallbackProps {
  label: string
}

export default function LoadingFallback({ label }: LoadingFallbackProps): JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-[320px] rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      {label}
    </div>
  )
}