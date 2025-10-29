/**
 * EventViewer Component
 *
 * Displays all events for the current active file in a table format.
 * Shows event details including ID, entity, attribute, value, and timestamp.
 */

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/app-store'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function EventViewer() {
  const { activeFileId, getEvents, loadEvents, isLoading } = useAppStore()
  const [events, setEvents] = useState<any[]>([])

  // Load events when active file changes
  useEffect(() => {
    if (activeFileId) {
      loadEvents(activeFileId)
    }
  }, [activeFileId, loadEvents])

  // Update events when store changes
  useEffect(() => {
    if (activeFileId) {
      const fileEvents = getEvents(activeFileId)
      setEvents(fileEvents)
    }
  }, [activeFileId, getEvents])

  if (!activeFileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="text-lg font-medium">No file selected</p>
          <p className="text-sm">Open a file to view events</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading events...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Events</h2>
        <p className="text-muted-foreground text-sm">
          {events.length} event{events.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Events Table */}
      <div className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-muted-foreground text-center">
              <p className="text-lg font-medium">No events found</p>
              <p className="text-sm">
                Events will appear here when you perform actions
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Event ID</TableHead>
                <TableHead className="w-[120px]">Entity</TableHead>
                <TableHead className="w-[150px]">Attribute</TableHead>
                <TableHead className="w-[200px]">Value</TableHead>
                <TableHead className="w-[150px]">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.event_id}>
                  <TableCell className="font-mono text-xs">
                    {event.event_id.substring(0, 8)}...
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {event.entity}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {event.attribute}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-mono text-xs">
                    {JSON.stringify(event.value)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {JSON.stringify(event.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
