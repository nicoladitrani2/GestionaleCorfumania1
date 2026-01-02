'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Calendar, Users, Clock, Timer, AlertCircle } from 'lucide-react'

interface WeeklyCalendarProps {
  excursions: any[]
}

export function WeeklyCalendar({ excursions }: WeeklyCalendarProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())

  // Helper to get start of week (Monday)
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    return new Date(d.setDate(diff))
  }

  const startOfWeek = getStartOfWeek(currentDate)
  
  // Generate 7 days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })

  const nextWeek = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 7)
    setCurrentDate(d)
  }

  const prevWeek = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 7)
    setCurrentDate(d)
  }

  const today = () => setCurrentDate(new Date())
  
  const isToday = (date: Date) => {
    const t = new Date()
    return date.getDate() === t.getDate() &&
           date.getMonth() === t.getMonth() &&
           date.getFullYear() === t.getFullYear()
  }

  const getDuration = (start: string, end: string | null) => {
    if (!end) return null
    const diff = new Date(end).getTime() - new Date(start).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-8 transition-all hover:shadow-lg">
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-lg shadow-sm">
                <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
                <h2 className="font-bold text-gray-900 text-lg">Calendario Escursioni</h2>
                <p className="text-sm text-gray-500 font-medium">
                    {startOfWeek.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} - {new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
            <button onClick={prevWeek} className="p-2 hover:bg-gray-50 rounded-md transition-colors text-gray-600 hover:text-blue-600"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={today} className="text-sm font-semibold px-4 py-2 hover:bg-gray-50 rounded-md transition-colors text-gray-700 hover:text-blue-600 border-x border-transparent hover:border-gray-100">Oggi</button>
            <button onClick={nextWeek} className="p-2 hover:bg-gray-50 rounded-md transition-colors text-gray-600 hover:text-blue-600"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-gray-200 min-h-[400px]">
        {weekDays.map((day) => {
            const dayExcursions = excursions.filter(e => {
                if (!e.startDate) return false
                const eDate = new Date(e.startDate)
                return eDate.getDate() === day.getDate() &&
                       eDate.getMonth() === day.getMonth() &&
                       eDate.getFullYear() === day.getFullYear()
            }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

            const isCurrentDay = isToday(day)

            return (
                <div key={day.toISOString()} className={`flex flex-row md:flex-col transition-colors duration-300 ${isCurrentDay ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'}`}>
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
                        {dayExcursions.length === 0 && (
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
