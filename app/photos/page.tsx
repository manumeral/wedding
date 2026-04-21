import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function PhotosPage() {
  // Replace this with actual Google Photos album URL
  const GOOGLE_PHOTOS_URL = "https://photos.google.com/album/placeholder"

  return (
    <main className="min-h-screen bg-gray-50 pb-20 flex flex-col">
      <header className="bg-rose-800 text-white py-6 px-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-rose-200 hover:text-white">← Back</Link>
          <h1 className="text-2xl font-serif">Wedding Gallery</h1>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-serif text-gray-900 mb-3">Share Your Memories</h2>
          <p className="text-gray-600 mb-8">
            We've created a shared Google Photos album for everyone to upload their candid shots and videos from the wedding. We can't wait to see the celebration through your eyes!
          </p>
          
          <a href={GOOGLE_PHOTOS_URL} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg h-14">
              Open Google Photos Album
            </Button>
          </a>
        </div>
      </div>
    </main>
  )
}