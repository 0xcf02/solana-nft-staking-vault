import React from "react"

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large"
  color?: "primary" | "error" | "warning" | "success" | string
  text?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = "medium", 
  color = "primary", 
  text 
}) => {
  const sizeClasses = {
    small: "h-4 w-4",
    medium: "h-8 w-8", 
    large: "h-12 w-12"
  }
  
  const colorClasses = {
    primary: "border-blue-600",
    error: "border-red-600",
    warning: "border-yellow-600", 
    success: "border-green-600"
  }
  
  const borderColor = colorClasses[color as keyof typeof colorClasses] || `border-${color}`
  
  return (
    <div className="flex flex-col justify-center items-center">
      <div className={`animate-spin rounded-full border-b-2 ${borderColor} ${sizeClasses[size]}`}></div>
      {text && <p className="mt-2 text-sm text-gray-600">{text}</p>}
    </div>
  )
}

export default LoadingSpinner
