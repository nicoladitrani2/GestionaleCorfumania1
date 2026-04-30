'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Calendar, Users, Clock, Timer, AlertCircle, Bus, Car } from 'lucide-react'

interface WeeklyCalendarProps {
  excursions: any[]
  transfers: any[]
}

export function WeeklyCalendar({ excursions, transfers }: WeeklyCalendarProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'WEEK' | 'MONTH' | 'RANGE'>('WEEK')
  const [rangeStart, setRangeStart] = useState<string>('')
  const [rangeEnd, setRangeEnd] = useState<string>('')
  const [rentals, setRentals] = useState<any[]>([])

  // Helper to get start of week (Monday)
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    return new Date(d.setDate(diff))
  }

  const addDays = (date: Date, days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
  }

  const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
  const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)

  const dateToInputValue = (date: Date) => {
    const y = date.getFullYear()
    const m = `${date.getMonth() + 1}`.padStart(2, '0')
    const d = `${date.getDate()}`.padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const inputValueToDate = (value: string) => {
    if (!value) return null
    const d = new Date(`${value}T00:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()

  const isWithinInclusive = (date: Date, start: Date, end: Date) =>
    date.getTime() >= start.getTime() && date.getTime() <= end.getTime()

  const dayKey = (date: Date) => {
    const y = date.getFullYear()
    const m = `${date.getMonth() + 1}`.padStart(2, '0')
    const d = `${date.getDate()}`.padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const startOfWeek = getStartOfWeek(currentDate)
  const endOfWeek = addDays(startOfWeek, 6)

  const rangeStartDate = useMemo(() => inputValueToDate(rangeStart), [rangeStart])
  const rangeEndDate = useMemo(() => inputValueToDate(rangeEnd), [rangeEnd])

  const viewStart = useMemo(() => {
    if (view === 'MONTH') return getStartOfWeek(startOfMonth(currentDate))
    if (view === 'RANGE' && rangeStartDate) return getStartOfWeek(rangeStartDate)
    return startOfWeek
  }, [view, currentDate, rangeStartDate])

  const viewEnd = useMemo(() => {
    if (view === 'MONTH') {
      const last = endOfMonth(currentDate)
      const lastStart = getStartOfWeek(last)
      return addDays(lastStart, 6)
    }
    if (view === 'RANGE' && rangeEndDate) {
      const lastStart = getStartOfWeek(rangeEndDate)
      return addDays(lastStart, 6)
    }
    return endOfWeek
  }, [view, currentDate, rangeEndDate, endOfWeek])

  const days = useMemo(() => {
    const list: Date[] = []
    const start = new Date(viewStart)
    const end = new Date(viewEnd)
    for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
      list.push(new Date(d))
    }
    return list
  }, [viewStart, viewEnd])

  const nextWeek = () => {
    const d = new Date(currentDate)
    if (view === 'MONTH') {
      d.setMonth(d.getMonth() + 1)
      setCurrentDate(d)
      return
    }
    if (view === 'RANGE') {
      if (!rangeStartDate || !rangeEndDate) return
      const diffDays = Math.max(1, Math.round((rangeEndDate.getTime() - rangeStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1)
      setRangeStart(dateToInputValue(addDays(rangeStartDate, diffDays)))
      setRangeEnd(dateToInputValue(addDays(rangeEndDate, diffDays)))
      return
    }
    d.setDate(d.getDate() + 7)
    setCurrentDate(d)
  }

  const prevWeek = () => {
    const d = new Date(currentDate)
    if (view === 'MONTH') {
      d.setMonth(d.getMonth() - 1)
      setCurrentDate(d)
      return
    }
    if (view === 'RANGE') {
      if (!rangeStartDate || !rangeEndDate) return
      const diffDays = Math.max(1, Math.round((rangeEndDate.getTime() - rangeStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1)
      setRangeStart(dateToInputValue(addDays(rangeStartDate, -diffDays)))
      setRangeEnd(dateToInputValue(addDays(rangeEndDate, -diffDays)))
      return
    }
    d.setDate(d.getDate() - 7)
    setCurrentDate(d)
  }

  const today = () => {
    const now = new Date()
    setCurrentDate(now)
    if (view === 'RANGE') {
      const start = getStartOfWeek(now)
      setRangeStart(dateToInputValue(start))
      setRangeEnd(dateToInputValue(addDays(start, 6)))
    }
  }
  
  const isToday = (date: Date) => {
    const t = new Date()
    return isSameDay(date, t)
  }

  const getDuration = (start: string, end: string | null) => {
    if (!end) return null
    const diff = new Date(end).getTime() - new Date(start).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
  }

  useEffect(() => {
    let cancelled = false

    const loadRentals = async () => {
      try {
        const res = await fetch('/api/participants?isRental=true')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) {
          setRentals(data)
        }
      } catch (error) {
        console.error('Failed to load rentals for calendar:', error)
      }
    }

    loadRentals()
  }, [])

  useEffect(() => {
    if (view !== 'RANGE') return
    if (rangeStart && rangeEnd) return
    const start = getStartOfWeek(currentDate)
    setRangeStart(dateToInputValue(start))
    setRangeEnd(dateToInputValue(addDays(start, 6)))
  }, [view, currentDate, rangeStart, rangeEnd])

  const excursionsByDay = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const ex of excursions || []) {
      if (!ex?.startDate) continue
      const k = dayKey(new Date(ex.startDate))
      const list = map.get(k) || []
      list.push(ex)
      map.set(k, list)
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      map.set(k, list)
    }
    return map
  }, [excursions])

  const transfersByDay = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const tr of transfers || []) {
      if (!tr?.date) continue
      const k = dayKey(new Date(tr.date))
      const list = map.get(k) || []
      list.push(tr)
      map.set(k, list)
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      map.set(k, list)
    }
    return map
  }, [transfers])

  const rentalsByDay = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const r of rentals || []) {
      if (!r?.bookingDate) continue
      const k = dayKey(new Date(r.bookingDate))
      const list = map.get(k) || []
      list.push(r)
      map.set(k, list)
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime())
      map.set(k, list)
    }
    return map
  }, [rentals])

  const headerSubtitle = useMemo(() => {
    if (view === 'MONTH') {
      return currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    }
    const start = viewStart
    const end = viewEnd
    return `${start.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} - ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`
  }, [view, currentDate, viewStart, viewEnd])

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-8 transition-all hover:shadow-lg">
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-lg shadow-sm">
                <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
                <h2 className="font-bold text-gray-900 text-lg">Calendario</h2>
                <p className="text-sm text-gray-500 font-medium">{headerSubtitle}</p>
            </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
            <button
              onClick={() => setView('WEEK')}
              className={`text-xs font-bold px-3 py-2 rounded-md transition-colors ${view === 'WEEK' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Settimana
            </button>
            <button
              onClick={() => setView('MONTH')}
              className={`text-xs font-bold px-3 py-2 rounded-md transition-colors ${view === 'MONTH' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Mese
            </button>
            <button
              onClick={() => setView('RANGE')}
              className={`text-xs font-bold px-3 py-2 rounded-md transition-colors ${view === 'RANGE' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Periodo
            </button>
          </div>

          {view === 'RANGE' && (
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-2 shadow-sm">
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="text-xs px-2 py-1 border border-gray-200 rounded-md"
              />
              <span className="text-xs text-gray-400">-</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="text-xs px-2 py-1 border border-gray-200 rounded-md"
              />
            </div>
          )}

          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
            <button onClick={prevWeek} className="p-2 hover:bg-gray-50 rounded-md transition-colors text-gray-600 hover:text-blue-600"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={today} className="text-sm font-semibold px-4 py-2 hover:bg-gray-50 rounded-md transition-colors text-gray-700 hover:text-blue-600 border-x border-transparent hover:border-gray-100">Oggi</button>
            <button onClick={nextWeek} className="p-2 hover:bg-gray-50 rounded-md transition-colors text-gray-600 hover:text-blue-600"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-gray-200 min-h-[400px]">
        {days.map((day) => {
            const isCurrentDay = isToday(day)
            const isOutsideRange =
              view === 'RANGE' && rangeStartDate && rangeEndDate
                ? !isWithinInclusive(day, rangeStartDate, rangeEndDate)
                : false

            const key = dayKey(day)
            const dayExcursions = isOutsideRange ? [] : (excursionsByDay.get(key) || [])
            const dayTransfers = isOutsideRange ? [] : (transfersByDay.get(key) || [])
            const dayRentals = isOutsideRange ? [] : (rentalsByDay.get(key) || [])

            return (
                <div key={day.toISOString()} className={`group flex flex-row md:flex-col transition-colors duration-300 ${isOutsideRange ? 'bg-gray-50/60 opacity-60' : isCurrentDay ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'}`}>
                    <div className={`p-3 text-center border-r md:border-r-0 border-b-0 md:border-b border-gray-100 transition-colors shrink-0 w-24 md:w-auto flex flex-col justify-center md:block ${isCurrentDay ? 'bg-blue-100/60' : ''}`}>
                        <span className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isCurrentDay ? 'text-blue-700' : 'text-gray-500'}`}>
                            {new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(day)}
                        </span>
                        <div className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm font-bold transition-all ${isCurrentDay ? 'bg-blue-600 text-white shadow-md scale-110' : 'text-gray-900'}`}>
                            {day.getDate()}
                        </div>
                    </div>
                    <div className="flex-1 p-2 space-y-3 min-w-0">
                        {dayExcursions.map(ex => {
                            const duration = getDuration(ex.startDate, ex.endDate)
                            const isDeadlineSoon = ex.confirmationDeadline && new Date(ex.confirmationDeadline) > new Date() && new Date(ex.confirmationDeadline).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000

                            return (
                                <div 
                                    key={ex.id}
                                    onClick={() => router.push(`/dashboard/excursions?id=${ex.id}`)}
                                    className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-400 cursor-pointer transition-all duration-200 overflow-hidden"
                                >
                                    {/* Left accent border */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    
                                    <div className="p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                                <Clock className="w-3 h-3" />
                                                <span>
                                                    {new Date(ex.startDate).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                    {ex.endDate && ` - ${new Date(ex.endDate).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                                                </span>
                                            </div>
                                            {duration && (
                                                <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium" title="Durata">
                                                    <Timer className="w-3 h-3" />
                                                    {duration}
                                                </div>
                                            )}
                                        </div>

                                        <h4 className="text-sm font-bold text-gray-900 leading-snug mb-2 line-clamp-2 group-hover:text-blue-700 transition-colors">
                                            {ex.name}
                                        </h4>

                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-md group-hover:bg-gray-100 transition-colors">
                                                <Users className="w-3.5 h-3.5" />
                                                <span className="font-semibold">{ex._count?.participants || 0}</span>
                                            </div>
                                            
                                            {isDeadlineSoon && (
                                                <div className="text-amber-500" title="Scadenza vicina">
                                                    <AlertCircle className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        {dayTransfers.map(tr => {
                            const duration = getDuration(tr.date, tr.endDate)

                            return (
                                <div 
                                    key={tr.id}
                                    onClick={() => router.push(`/dashboard/transfers?id=${tr.id}`)}
                                    className="group relative bg-white rounded-xl border border-orange-200 shadow-sm hover:shadow-lg hover:border-orange-400 cursor-pointer transition-all duration-200 overflow-hidden"
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    
                                    <div className="p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-md">
                                                <Clock className="w-3 h-3" />
                                                <span>
                                                    {new Date(tr.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                    {tr.endDate && ` - ${new Date(tr.endDate).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                                                </span>
                                            </div>
                                            {duration && (
                                                <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                                                    <Timer className="w-3 h-3" />
                                                    {duration}
                                                </div>
                                            )}
                                        </div>

                                        <h4 className="text-sm font-bold text-gray-900 leading-snug mb-2 line-clamp-2 group-hover:text-orange-700 transition-colors">
                                            {tr.name}
                                        </h4>

                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-md group-hover:bg-gray-100 transition-colors">
                                                <Bus className="w-3.5 h-3.5 text-orange-500" />
                                                <span className="font-semibold">{tr._count?.participants || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        {dayRentals.map(r => {
                            const pax = (r.adults || 0) + (r.children || 0) + (r.infants || 0) || 1
                            const name =
                              `${r.firstName || ''} ${r.lastName || ''}`.trim() ||
                              r.name ||
                              'Noleggio'
                            const breakdownParts: string[] = []
                            if (r.adults) breakdownParts.push(`${r.adults}A`)
                            if (r.children) breakdownParts.push(`${r.children}B`)
                            if (r.infants) breakdownParts.push(`${r.infants}I`)
                            const breakdown =
                              breakdownParts.length > 0
                                ? ` (${breakdownParts.join(' ')})`
                                : ''

                            return (
                              <div
                                key={r.id}
                                onClick={() => router.push('/dashboard/rentals')}
                                className="group relative bg-white rounded-xl border border-emerald-200 shadow-sm hover:shadow-lg hover:border-emerald-400 cursor-pointer transition-all duration-200 overflow-hidden"
                              >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                                      <Car className="w-3 h-3" />
                                      <span>Noleggio</span>
                                    </div>
                                  </div>

                                  <h4 className="text-sm font-bold text-gray-900 leading-snug mb-2 line-clamp-2 group-hover:text-emerald-700 transition-colors">
                                    {name}
                                  </h4>

                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-md group-hover:bg-gray-100 transition-colors">
                                      <Users className="w-3.5 h-3.5 text-emerald-500" />
                                      <span className="font-semibold">
                                        {pax} pax{breakdown}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                        })}
                        {dayExcursions.length === 0 && dayTransfers.length === 0 && dayRentals.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center min-h-[60px] opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-1 h-1 bg-gray-300 rounded-full mb-1"></div>
                                <div className="w-1 h-1 bg-gray-300 rounded-full mb-1"></div>
                                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                            </div>
                        )}
                    </div>
                </div>
            )
        })}
      </div>
    </div>
  )
}
