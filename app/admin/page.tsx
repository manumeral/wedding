import { getAllRequests, updateRequestStatus } from '@/app/actions/requests'
import { getUserProfile } from '@/app/actions/user'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AdminPage() {
  const profile = await getUserProfile()
  if (!profile?.is_admin) redirect('/')

  const requests = await getAllRequests()

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gray-900 text-white py-6 px-4 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white">← Home</Link>
            <h1 className="text-2xl font-serif">Organizer Dashboard</h1>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm">
                  <th className="p-4 font-medium">Time</th>
                  <th className="p-4 font-medium">Guest</th>
                  <th className="p-4 font-medium">Room</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Details</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 text-sm">
                    <td className="p-4 text-gray-500">{new Date(req.created_at).toLocaleTimeString()}</td>
                    <td className="p-4 font-medium">{req.users?.full_name || 'Unknown'}</td>
                    <td className="p-4">{req.users?.room_number || '-'}</td>
                    <td className="p-4 capitalize">{req.type}</td>
                    <td className="p-4 max-w-xs truncate" title={req.details}>{req.details}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        req.status === 'claimed' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {req.status === 'pending' && (
                        <form action={updateRequestStatus.bind(null, req.id, 'claimed')}>
                          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs px-3 py-1">Claim</Button>
                        </form>
                      )}
                      {req.status === 'claimed' && (
                        <form action={updateRequestStatus.bind(null, req.id, 'resolved')}>
                          <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs px-3 py-1">Resolve</Button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">No requests found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}