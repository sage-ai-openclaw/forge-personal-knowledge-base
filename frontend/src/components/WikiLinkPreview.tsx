// WikiLinkPreview component for showing preview on hover
// Currently not implemented - can be enhanced later

interface WikiLinkPreviewProps {
  title: string;
  children: React.ReactNode;
}

export function WikiLinkPreview({ children }: WikiLinkPreviewProps) {
  // For now, just render children without preview functionality
  return <>{children}</>;
}
