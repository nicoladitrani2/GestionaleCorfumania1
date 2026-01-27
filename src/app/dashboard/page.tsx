import Link from 'next/link'
import { Map, Users, Settings, Briefcase, Bus, PieChart, Car, AlertTriangle } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { WeeklyCalendar } from './WeeklyCalendar'
import { ApprovalsWidget } from './ApprovalsWidget'

export default async function DashboardPage() {
  const session = await getSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  // Fetch pending approvals if admin
  let pendingApprovals: any[] = []
  if (isAdmin) {
    pendingApprovals = await prisma.participant.findMany({
      where: { approvalStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        excursion: { select: { name: true, startDate: true } },
        transfer: { select: { name: true, date: true } },
        createdBy: { select: { firstName: true, lastName: true, email: true } }
      }
    })
  }

  // Fetch all excursions for calendar
  let excursionsData: any[] = []
  let connectionError = false

  try {
    excursionsData = await prisma.excursion.findMany({
      orderBy: { startDate: 'asc' },
      include: {
        participants: {
          where: { isExpired: false },
          select: { groupSize: true }
        }
      }
    })
  } catch (error) {
    console.warn('Failed to fetch excursions for dashboard calendar:', error)
    connectionError = true
  }

  const excursions = excursionsData.map(excursion => {
    const totalParticipants = excursion.participants.reduce((sum: number, p: any) => sum + (p.groupSize || 1), 0)
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

  // Format pending approvals for widget
  const formattedApprovals = pendingApprovals.map(p => ({
    ...p,
    excursion: p.excursion ? { ...p.excursion, startDate: p.excursion.startDate.toISOString() } : null,
    transfer: p.transfer ? { ...p.transfer, date: p.transfer.date.toISOString() } : null,
    rentalStartDate: p.rentalStartDate ? p.rentalStartDate.toISOString() : null,
  }))

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
      title: 'Fornitori',
      description: 'Gestione fornitori escursioni',
      icon: Briefcase,
      href: '/dashboard/suppliers',
      color: 'bg-emerald-500',
      visible: isAdmin
    },
  ]

  return (
    <div className="py-4 space-y-8">
      {connectionError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 font-medium">
                Connessione al database instabile
              </p>
              <p className="text-sm text-yellow-600 mt-1">
                Il database si sta risvegliando. Se non vedi i dati nel calendario, prova a ricaricare la pagina tra qualche secondo.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {isAdmin && <ApprovalsWidget participants={formattedApprovals} />}

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
