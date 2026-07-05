export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-full overflow-auto">{children}</div>
}
