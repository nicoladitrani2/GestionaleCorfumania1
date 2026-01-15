import Link from 'next/link'
import { Map, Users, Settings, Briefcase, Bus, PieChart, Car } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { WeeklyCalendar } from './WeeklyCalendar'

export default async function DashboardPage() {
  const session = await getSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  // Fetch all excursions for calendar
  const excursionsData = await prisma.excursion.findMany({
    orderBy: { startDate: 'asc' },
    include: {
      participants: {
        where: { isExpired: false },
        select: { groupSize: true }
      }
    }
  })

  const excursions = excursionsData.map(excursion => {
    const totalParticipants = excursion.participants.reduce((sum, p) => sum + (p.groupSize || 1), 0)
    const { participants, ...rest } = excursion
    return {
      ...rest,
      startDate: rest.startDate.toISOString(),
      endDate: rest.endDate?.toISOString() || null,
      confirmationDeadline: rest.confirmationDeadline?.toISOString() || null,
      createdAt: rest.createdAt.toISOString(),
      updatedAt: rest.updatedAt.toISOString(),
      _count: {
        participants: totalParticipants
      }
    }
  })

  const modules = [
    {
      title: 'Escursioni',
      description: 'Gestisci le escursioni, le partenze e i partecipanti',
      icon: Map,
      href: '/dashboard/excursions',
      color: 'bg-blue-500',
      visible: true
    },
    {
      title: 'Trasferimenti',
      description: 'Gestione trasferimenti e partecipanti',
      icon: Bus,
      href: '/dashboard/transfers',
      color: 'bg-orange-500',
      visible: true
    },
    {
      title: 'Noleggi',
      description: 'Gestione noleggi e partecipanti',
      icon: Car,
      href: '/dashboard/rentals',
      color: 'bg-green-500',
      visible: true
    },
    {
      title: 'Reports',
      description: 'Statistiche e report avanzati',
      icon: PieChart,
      href: '/dashboard/reports',
      color: 'bg-indigo-500',
      visible: isAdmin
    },
    {
      title: 'Assistenti',
      description: 'Gestione account e permessi',
      icon: Users,
      href: '/dashboard/users',
      color: 'bg-purple-500',
      visible: isAdmin
    },
    {
      title: 'Rifornitori',
      description: 'Gestione rifornitori escursioni',
      icon: Briefcase,
      href: '/dashboard/suppliers',
      color: 'bg-emerald-500',
      visible: isAdmin
    },
  ]

  return (
    <div className="py-4 space-y-8">
      <WeeklyCalendar excursions={excursions} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.filter(m => m.visible).map((module) => (
          <Link 
            key={module.title} 
            href={module.href}
            className="block group"
          >
            <div className="bg-white overflow-hidden rounded-lg shadow hover:shadow-md transition-shadow duration-200 border border-gray-200 h-full">
              <div className="p-6">
                <div className={`inline-flex p-3 rounded-lg ${module.color} text-white mb-4`}>
                  <module.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {module.title}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {module.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
