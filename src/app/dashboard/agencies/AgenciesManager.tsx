'use client'

import { useState, useEffect } from 'react'
import { Plus, Home, Trash2, Edit } from 'lucide-react'
import Link from 'next/link'
import { AgencyForm } from './AgencyForm'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { AlertModal } from '../components/AlertModal'

export type Agency = {
  id: string
  name: string
  createdAt: string
  defaultCommission: number
  commissionType: 'PERCENTAGE' | 'FIXED'
}

export function AgenciesManager() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: 'danger' | 'warning' | 'info'
    onConfirm: () => Promise<void>
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    onConfirm: async () => {}
  })
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: 'success' | 'error' | 'info' | 'warning'
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  })

  useEffect(() => {
    fetchAgencies()
  }, [])

  const fetchAgencies = async () => {
    try {
      const res = await fetch('/api/agencies')
      if (res.ok) {
        const data = await res.json()
        setAgencies(data)
      }
    } catch (error) {
      console.error('Error fetching agencies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (agency: Agency) => {
    setEditingAgency(agency)
    setIsFormOpen(true)
  }

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Elimina Agenzia',
      message: 'Sei sicuro di voler eliminare questa agenzia?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/agencies/${id}`, {
            method: 'DELETE'
          })
          if (res.ok) {
            fetchAgencies()
            setAlertModal({
              isOpen: true,
              title: 'Successo',
              message: 'Agenzia eliminata con successo',
              variant: 'success'
            })
          } else {
            setAlertModal({
              isOpen: true,
              title: 'Errore',
              message: 'Impossibile eliminare l\'agenzia (potrebbe essere associata a utenti o commissioni)',
              variant: 'error'
            })
          }
        } catch (error) {
          console.error('Error deleting agency:', error)
          setAlertModal({
            isOpen: true,
            title: 'Errore',
            message: 'Si è verificato un errore durante l\'eliminazione',
            variant: 'error'
          })
        }
      }
    })
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingAgency(null)
  }

  const handleFormSubmit = () => {
    fetchAgencies()
    handleFormClose()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/dashboard" className="text-gray-500 hover:text-blue-600 flex items-center gap-1 text-sm font-medium transition-colors">
          <Home className="w-4 h-4" />
          Home
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium text-sm">Agenzie</span>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestione Agenzie</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestisci le agenzie partner e le loro commissioni
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Nuova Agenzia
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commissione</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Creazione</th>
                <th className="relative px-6 py-3"><span className="sr-only">Azioni</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agencies.map((agency) => (
                <tr key={agency.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agency.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {agency.defaultCommission || 0}
                    {agency.commissionType === 'FIXED' ? '€' : '%'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(agency.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleEdit(agency)} className="text-blue-600 hover:text-blue-900 mr-4"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(agency.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {agencies.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500">Nessuna agenzia trovata</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <AgencyForm 
          agency={editingAgency} 
          onClose={handleFormClose} 
          onSubmit={handleFormSubmit} 
        />
      )}
    </div>
  )
}
