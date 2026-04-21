export function Itinerary({ events }: { events: any[] }) {
  // If database is empty, fallback to hardcoded list
  const displayEvents = events.length > 0 ? events : [
    { name: "Tilak", date: "25th April '26 (Afternoon)", location: "Vijaya Grand, Ashiana Nagar Patna" },
    { name: "Haldi", date: "26th April '26 (Afternoon)", location: "Chanakya Hotel, R Block, Patna" },
    { name: "Sangeet", date: "26th April '26 (Evening)", location: "Chanakya Hotel, R Block, Patna" },
    { name: "Wedding", date: "27th April '26 (Night)", location: "Chanakya Hotel, R Block, Patna" },
    { name: "Reception", date: "29th April '26 (Night)", location: "Grand Ivory, Biscoman Bhavan, Patna" },
    { name: "Reception", date: "2nd May '26 (Night)", location: "Bokaro Steel City" },
  ]

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-rose-100">
      <h2 className="text-2xl font-serif text-rose-800 mb-6">Wedding Itinerary</h2>
      <div className="space-y-6">
        {displayEvents.map((event, i) => (
          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <div className="sm:w-1/3">
              <h3 className="font-semibold text-gray-900">{event.name}</h3>
              <p className="text-sm text-gray-500">{event.date}</p>
            </div>
            <div className="sm:w-2/3 text-gray-700">
              <p>{event.location}</p>
            </div>
            {event.live_status_message && (
              <div className="mt-2 sm:mt-0 px-3 py-1 bg-rose-100 text-rose-800 text-xs rounded-full font-medium inline-block">
                {event.live_status_message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}