'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Save, X, Briefcase, Search, AlertCircle } from 'lucide-react'

interface Supplier {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers')
      if (res.ok) {
        setSuppliers(await res.json())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setFormData({ name: '' })
    setEditingId(null)
    setIsCreating(true)
    setError('')
  }

  const handleEdit = (supplier: Supplier) => {
    setFormData({ name: supplier.name })
    setEditingId(supplier.id)
    setIsCreating(true)
    setError('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo fornitore?')) return

    try {
      const res = await fetch(`/api/suppliers?id=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchSuppliers()
      } else {
        const data = await res.json()
        alert(data.error || 'Errore durante l\'eliminazione')
      }
    } catch (e) {
      alert('Errore di rete')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const url = '/api/suppliers'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId ? { id: editingId, ...formData } : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setIsCreating(false)
        fetchSuppliers()
      } else {
        const data = await res.json()
        setError(data.error || 'Errore durante il salvataggio')
      }
    } catch (e) {
      setError('Errore di rete')
    }
  }

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-8 h-8 text-blue-600" />
            Gestione Rifornitori
          </h1>
          <p className="text-gray-500 mt-1">Aggiungi, modifica o elimina i rifornitori per le escursioni</p>
        </div>
        
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md transition-all transform hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Nuovo Rifornitore
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Cerca rifornitore..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Caricamento...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center text-gray-500">
            <Briefcase className="w-12 h-12 text-gray-300 mb-3" />
            <p>Nessun rifornitore trovato</p>
            {searchTerm && <button onClick={() => setSearchTerm('')} className="text-blue-600 mt-2 hover:underline">Rimuovi filtri</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">Data Creazione</th>
                  <th className="px-6 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">{supplier.name}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(supplier.createdAt).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(supplier)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifica"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(supplier.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Creazione/Modifica */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {editingId ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingId ? 'Modifica Rifornitore' : 'Nuovo Rifornitore'}
              </h3>
              <button 
                onClick={() => setIsCreating(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
                   <AlertCircle className="w-4 h-4 shrink-0" />
                   {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Rifornitore</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Es. Go4Sea"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-medium shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
