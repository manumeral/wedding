import { getUserProfile, getEvents } from '@/app/actions/user'
import { Itinerary } from '@/components/Itinerary'
import Link from 'next/link'

export default async function Home() {
  const profile = await getUserProfile()
  const events = await getEvents()

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-rose-800 text-white py-6 px-4 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-serif">Prachi & Mayank</h1>
          <nav className="hidden sm:flex gap-6">
            <Link href="/" className="hover:text-rose-200">Home</Link>
            <Link href="/requests" className="hover:text-rose-200">Request Help</Link>
            <Link href="/photos" className="hover:text-rose-200">Photos</Link>
            {profile?.is_admin && (
              <Link href="/admin" className="font-bold text-yellow-300 hover:text-yellow-100">Admin</Link>
            )}
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        {/* Welcome & Logistics */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-2">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}!</h2>
          <p className="text-gray-600 mb-4">We are so excited to celebrate our special days with you.</p>
          
          {profile?.room_number ? (
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
              <p className="text-blue-800">
                <span className="font-bold">Your Room Allocation:</span> Room {profile.room_number}
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
              <p className="text-gray-600">Your room allocation will appear here once assigned by the organizers.</p>
            </div>
          )}
        </section>

        {/* Itinerary */}
        <Itinerary events={events} />
        
        {/* Quick Links for Mobile */}
        <div className="grid grid-cols-2 gap-4 sm:hidden">
          <Link href="/requests" className="bg-white p-4 rounded-xl shadow-sm text-center font-medium text-rose-700 border border-rose-100">
            Request Help
          </Link>
          <Link href="/photos" className="bg-white p-4 rounded-xl shadow-sm text-center font-medium text-rose-700 border border-rose-100">
            Photos
          </Link>
        </div>
      </div>
    </main>
  )
}