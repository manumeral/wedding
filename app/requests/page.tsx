import { submitRequest, getMyRequests } from '@/app/actions/requests'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function RequestsPage() {
  const requests = await getMyRequests()

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-rose-800 text-white py-6 px-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-rose-200 hover:text-white">← Back</Link>
          <h1 className="text-2xl font-serif">Request Help</h1>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 mt-8 space-y-8">
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4">Need Assistance?</h2>
          <form action={submitRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">What do you need?</label>
              <select name="type" className="w-full p-3 border rounded-md border-gray-300 focus:ring-rose-500 bg-white" required>
                <option value="cab">Cab Ride / Transport</option>
                <option value="pickup">Station/Airport Pickup</option>
                <option value="water">Water Bottle / Refreshments</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Details</label>
              <textarea 
                name="details" 
                rows={3} 
                className="w-full p-3 border rounded-md border-gray-300 focus:ring-rose-500"
                placeholder="E.g., I'm at Patna Junction platform 1, family of 4."
              ></textarea>
            </div>
            <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white">
              Submit Request
            </Button>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Your Recent Requests</h2>
          {requests.length === 0 ? (
            <p className="text-gray-500 italic">You haven't made any requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="bg-white p-4 rounded-lg shadow-sm border flex justify-between items-center">
                  <div>
                    <p className="font-medium capitalize">{req.type}</p>
                    {req.details && <p className="text-sm text-gray-600 truncate max-w-[200px] sm:max-w-xs">{req.details}</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(req.created_at).toLocaleTimeString()}</p>
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      req.status === 'claimed' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}