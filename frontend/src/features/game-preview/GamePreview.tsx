import { useEffect, useMemo, useRef } from 'react';

interface Props {
  htmlString?: string;
  title?: string;
  height?: number;
}

// Renders a backend-generated HTML string in an isolated iframe via srcdoc.
export default function GamePreview({ htmlString, title = 'Game preview', height = 540 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const srcdoc = useMemo(() => htmlString || '', [htmlString]);

  useEffect(() => {
    // Force a reload when the html string changes
    if (iframeRef.current && srcdoc) {
      iframeRef.current.srcdoc = srcdoc;
    }
  }, [srcdoc]);

  if (!htmlString) {
    return (
      <div className="empty card" style={{ padding: 32 }}>
        No preview yet. Generate a game to see it here.
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <iframe
        ref={iframeRef}
        title={title}
        sandbox="allow-scripts allow-pointer-lock"
        referrerPolicy="no-referrer"
        srcDoc={srcdoc}
        style={{ width: '100%', height, border: 0, display: 'block', background: '#0b0f16' }}
      />
    </div>
  );
}
