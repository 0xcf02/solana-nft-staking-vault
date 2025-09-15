'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useIntersectionObserver } from '@/utils/performance'

interface LazyImageProps {
  src: string
  alt: string
  placeholder?: string
  className?: string
  width?: number | string
  height?: number | string
  blurDataURL?: string
  priority?: boolean
  quality?: number
  onLoad?: () => void
  onError?: (error: Error) => void
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjYWFhIj5Mb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg==',
  className = '',
  width,
  height,
  blurDataURL,
  priority = false,
  quality = 75,
  onLoad,
  onError
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageSrc, setImageSrc] = useState(placeholder)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const isVisible = useIntersectionObserver(containerRef, {
    threshold: 0.1,
    rootMargin: '50px'
  })

  // Load image when visible or if priority is set
  useEffect(() => {
    if ((isVisible || priority) && !imageLoaded && !imageError) {
      loadImage()
    }
  }, [isVisible, priority, imageLoaded, imageError, src])

  const loadImage = () => {
    const img = new Image()
    
    img.onload = () => {
      setImageSrc(src)
      setImageLoaded(true)
      onLoad?.()
    }
    
    img.onerror = (error) => {
      setImageError(true)
      const errorObj = new Error(`Failed to load image: ${src}`)
      onError?.(errorObj)
      console.error('Image load error:', error)
    }
    
    // Optimize image URL with quality parameter
    const optimizedSrc = optimizeImageUrl(src, {
      quality,
      width: typeof width === 'number' ? width : undefined,
      height: typeof height === 'number' ? height : undefined
    })
    
    img.src = optimizedSrc
  }

  const optimizeImageUrl = (
    url: string, 
    options: { quality?: number; width?: number; height?: number }
  ): string => {
    // If it's an external URL or already optimized, return as is
    if (url.startsWith('http') || url.includes('?')) {
      return url
    }
    
    const params = new URLSearchParams()
    
    if (options.quality && options.quality !== 75) {
      params.append('q', options.quality.toString())
    }
    
    if (options.width) {
      params.append('w', options.width.toString())
    }
    
    if (options.height) {
      params.append('h', options.height.toString())
    }
    
    const queryString = params.toString()
    return queryString ? `${url}?${queryString}` : url
  }

  // Generate blur placeholder if provided
  const blurStyle = blurDataURL && !imageLoaded ? {
    backgroundImage: `url(${blurDataURL})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(8px)'
  } : {}

  // Error fallback
  if (imageError) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-gray-200 ${className}`}
        style={{
          width: width || '100%',
          height: height || '200px'
        }}
      >
        <div className="text-center text-gray-500">
          <svg 
            className="w-8 h-8 mx-auto mb-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
          <p className="text-sm">Failed to load image</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef} 
      className={`relative overflow-hidden ${className}`}
      style={{
        width: width || '100%',
        height: height || 'auto'
      }}
    >
      {/* Blur background */}
      {blurDataURL && !imageLoaded && (
        <div 
          className="absolute inset-0"
          style={blurStyle}
        />
      )}
      
      {/* Main image */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`
          w-full h-full object-cover transition-opacity duration-300
          ${imageLoaded ? 'opacity-100' : 'opacity-0'}
        `}
        style={{
          width: width || '100%',
          height: height || 'auto'
        }}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
      
      {/* Loading overlay */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-pulse text-gray-400">
            <svg 
              className="w-6 h-6 animate-spin" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

// Gallery component with lazy loading and virtualization
interface LazyImageGalleryProps {
  images: Array<{
    src: string
    alt: string
    thumbnail?: string
  }>
  columns?: number
  gap?: number
  className?: string
}

export const LazyImageGallery: React.FC<LazyImageGalleryProps> = ({
  images,
  columns = 3,
  gap = 16,
  className = ''
}) => {
  const [loadedCount, setLoadedCount] = useState(0)
  
  const handleImageLoad = () => {
    setLoadedCount(prev => prev + 1)
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Progress indicator */}
      {loadedCount < images.length && (
        <div className="mb-4 bg-gray-200 rounded-full h-1">
          <div 
            className="bg-blue-600 h-1 rounded-full transition-all duration-300"
            style={{ width: `${(loadedCount / images.length) * 100}%` }}
          />
        </div>
      )}
      
      {/* Image grid */}
      <div 
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: `${gap}px`
        }}
      >
        {images.map((image, index) => (
          <LazyImage
            key={`${image.src}-${index}`}
            src={image.src}
            alt={image.alt}
            placeholder={image.thumbnail}
            className="aspect-square rounded-lg"
            onLoad={handleImageLoad}
            priority={index < columns} // Load first row with priority
          />
        ))}
      </div>
      
      {/* Loading status */}
      <div className="mt-4 text-center text-sm text-gray-600">
        {loadedCount === images.length 
          ? `All ${images.length} images loaded`
          : `Loading... ${loadedCount}/${images.length}`
        }
      </div>
    </div>
  )
}

export default LazyImage