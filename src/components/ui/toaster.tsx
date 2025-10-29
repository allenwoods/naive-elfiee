/**
 * Custom Toaster Component
 *
 * Integrates Sonner with our app-store notification system
 */

import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/app-store'

export function Toaster() {
  const { notifications, removeNotification } = useAppStore()

  useEffect(() => {
    // Get the latest notification that hasn't been shown yet
    const latestNotification = notifications[notifications.length - 1]

    if (latestNotification) {
      // Show toast based on type
      const toastId =
        latestNotification.type === 'error'
          ? toast.error(latestNotification.message)
          : latestNotification.type === 'warning'
            ? toast.warning(latestNotification.message)
            : latestNotification.type === 'info'
              ? toast.info(latestNotification.message)
              : toast.success(latestNotification.message)

      // Remove the notification from store after showing
      // Use a small delay to ensure the toast is displayed
      setTimeout(() => {
        removeNotification(latestNotification.id)
      }, 100)
    }
  }, [notifications, removeNotification])

  return null
}
