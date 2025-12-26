"use client";

import * as React from "react";
import { LineItem } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface LineItemsTooltipProps {
  items: LineItem[] | null;
  loading: boolean;
  mouseX: number;
  mouseY: number;
}

export function LineItemsTooltip({ items, loading, mouseX, mouseY }: LineItemsTooltipProps) {
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ x: mouseX, y: mouseY });

  React.useEffect(() => {
    if (!tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let x = mouseX + 15; // Offset from cursor
    let y = mouseY + 15;

    // Prevent going off-screen to the right
    if (x + rect.width > windowWidth) {
      x = mouseX - rect.width - 15; // Show to the left of cursor
    }

    // Prevent going off-screen at the bottom
    if (y + rect.height > windowHeight) {
      y = mouseY - rect.height - 15; // Show above cursor
    }

    setPosition({ x, y });
  }, [mouseX, mouseY, items, loading]);

  if (!loading && (!items || items.length === 0)) {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[300px] max-w-[400px] max-h-[400px] overflow-auto pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading items...</span>
        </div>
      ) : items && items.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Items ({items.length})
          </h4>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={item.id || index} className="text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <div className="font-medium text-gray-900 mb-1">{item.description}</div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Qty: {item.quantity}</span>
                  <span>Price: RM {item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="font-medium text-gray-900">
                    RM {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}



