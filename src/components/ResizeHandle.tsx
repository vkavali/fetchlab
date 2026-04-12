import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  className?: string;
}

export default function ResizeHandle({ direction, onResize, className = '' }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
  }, [direction]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - lastPos.current;
      lastPos.current = currentPos;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, direction, onResize]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`${isHorizontal ? 'w-1 cursor-col-resize hover:w-1.5' : 'h-1 cursor-row-resize hover:h-1.5'} flex-shrink-0 transition-all group ${className}`}
    >
      <div
        className={`${isHorizontal ? 'w-px h-full mx-auto' : 'h-px w-full my-auto'} transition-colors ${
          isDragging ? 'bg-brand-400' : 'bg-gray-800 group-hover:bg-gray-600'
        }`}
      />
    </div>
  );
}
