import Link from 'next/link'
import { Map, Users, Settings, Briefcase, Bus } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { WeeklyCalendar } from './WeeklyCalendar'
import { CommissionsDashboard } from './CommissionsDashboard'

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

  // Calculate Commission Stats
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    include: { supplier: true }
  })

  const excursionsWithCommissions = await prisma.excursion.findMany({
    include: { commissions: true }
  })

  const validParticipants = await prisma.participant.findMany({
    where: {
      paymentType: { not: 'REFUNDED' },
      isExpired: false,
      excursionId: { not: null },
      createdById: { in: users.map(u => u.id) }
    },
    select: {
      id: true,
      price: true,
      createdById: true,
      excursionId: true
    }
  })

  const commissionStats = users.map(user => {
    const userParticipants = validParticipants.filter(p => p.createdById === user.id)
    
    let totalCommission = 0
    let totalSales = 0

    userParticipants.forEach(p => {
      if (!p.excursionId) return
      
      const excursion = excursionsWithCommissions.find(e => e.id === p.excursionId)
      if (!excursion) return

      if (!user.supplierId) {
          totalSales += p.price || 0
          return
      }

      const commissionConfig = excursion.commissions.find(c => c.supplierId === user.supplierId)
      const percentage = commissionConfig ? commissionConfig.commissionPercentage : 0
      
      const saleAmount = p.price || 0
      const commissionAmount = saleAmount * (percentage / 100)
      
      totalSales += saleAmount
      totalCommission += commissionAmount
    })

    return {
      userId: user.id,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      supplierName: user.supplier?.name || '',
      totalCommission,
      totalSales,
      excursionsCount: userParticipants.length
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

      <CommissionsDashboard 
        role={session?.user?.role || 'USER'} 
        currentUserId={session?.user?.id || ''} 
        stats={commissionStats} 
      />

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
