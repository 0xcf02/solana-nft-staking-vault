'use client'

import React, { useMemo } from 'react'
import { useVirtualScroll } from '@/utils/performance'

interface VirtualizedListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  getItemKey?: (item: T, index: number) => string | number
  className?: string
  overscan?: number
  onScroll?: (scrollTop: number) => void
}

function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  getItemKey = (_, index) => index,
  className = '',
  overscan = 5,
  onScroll
}: VirtualizedListProps<T>) {
  const {
    visibleItems,
    totalHeight,
    onScroll: handleScroll,
    offsetY
  } = useVirtualScroll(items, {
    itemHeight,
    containerHeight,
    overscan
  })

  const handleScrollEvent = (event: React.UIEvent<HTMLDivElement>) => {
    handleScroll(event)
    onScroll?.(event.currentTarget.scrollTop)
  }

  const visibleItemsWithKeys = useMemo(() => {
    return visibleItems.map(({ item, index }) => ({
      item,
      index,
      key: getItemKey(item, index)
    }))
  }, [visibleItems, getItemKey])

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScrollEvent}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0
          }}
        >
          {visibleItemsWithKeys.map(({ item, index, key }) => (
            <div
              key={key}
              style={{ height: itemHeight }}
              className="flex-shrink-0"
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default VirtualizedList