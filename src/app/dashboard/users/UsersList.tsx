'use client'

import { Edit, Trash2, Shield, User as UserIcon } from 'lucide-react'
import type { User } from './UsersManager'

interface UsersListProps {
  users: User[]
  currentUserId: string
  onEdit: (user: User) => void
  onDelete: (id: string) => void
}

export function UsersList({ users, currentUserId, onEdit, onDelete }: UsersListProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Utente
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ruolo
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Codice
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data Creazione
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Azioni</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                      {user.role === 'ADMIN' ? <Shield className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === 'ADMIN' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {user.code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onEdit(user)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                    title="Modifica"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => onDelete(user.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
