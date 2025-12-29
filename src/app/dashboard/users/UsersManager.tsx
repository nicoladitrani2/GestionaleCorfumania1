'use client'

import { useState, useEffect } from 'react'
import { Plus, Home, Users } from 'lucide-react'
import Link from 'next/link'
import { UsersList } from './UsersList'
import { UserForm } from './UserForm'

export type User = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  code: string
  createdAt: string
}

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<User[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo utente?')) return

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingUser(null)
  }

  const handleFormSubmit = () => {
    fetchUsers()
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
        <span className="text-gray-900 font-medium text-sm">Assistenti</span>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestione Assistenti</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestisci gli account del personale e i loro permessi
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Nuovo Assistente
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <UsersList 
          users={users} 
          currentUserId={currentUserId}
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      )}

      {isFormOpen && (
        <UserForm 
          user={editingUser} 
          onClose={handleFormClose} 
          onSubmit={handleFormSubmit} 
        />
      )}
    </div>
  )
}
