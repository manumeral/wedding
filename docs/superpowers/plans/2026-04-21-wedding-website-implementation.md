# Wedding Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom wedding web application for Prachi & Mayank featuring guest logistics, a request center, and an admin dashboard.

**Architecture:** A monolithic Next.js application using Server Actions for data fetching and mutations, interfacing with a Supabase PostgreSQL database. The application is split into public routes (login), protected guest routes (dashboard, request center, photos), and protected admin routes (admin dashboard).

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, Supabase (Auth + DB), Lucide React (icons).

---

### Task 1: Project Scaffolding & Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`
- Create: `.env.local.example`
- Create: `components/ui/button.tsx`

- [ ] **Step 1: Initialize Next.js app and install dependencies**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir false --import-alias "@/*" --use-npm -y
npm install @supabase/supabase-js @supabase/ssr lucide-react clsx tailwind-merge
```

- [ ] **Step 2: Configure Supabase Environment Variables**

Create `.env.local.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- [ ] **Step 3: Setup Utility Functions**

Create `lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Create a basic Button component**

Create `components/ui/button.tsx`:
```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4",
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
```

- [ ] **Step 5: Verify setup by running dev server**

```bash
npm run dev &
sleep 5
curl http://localhost:3000
kill %1
```
Expected: HTML output containing Next.js default page or a simple app layout.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: initial next.js setup with tailwind and supabase deps"
```

---

### Task 2: Supabase Client Setup & Database Schema

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write Database Schema SQL**

Create `supabase/schema.sql`:
```sql
-- Create users profile table (extends auth.users)
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  full_name text,
  is_admin boolean default false not null,
  room_number text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create requests table
create table public.requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade not null,
  type text not null check (type in ('cab', 'water', 'pickup', 'other')),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'resolved')),
  assigned_admin_id uuid references public.users on delete set null,
  details text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create events table
create table public.events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  live_status_message text,
  date timestamp with time zone not null,
  location text not null,
  order_index integer not null
);

-- Setup RLS
alter table public.users enable row level security;
alter table public.requests enable row level security;
alter table public.events enable row level security;

-- Users policies
create policy "Users can view own profile." on users for select using (auth.uid() = id);
create policy "Admins can view all profiles." on users for select using (
  exists (select 1 from users where id = auth.uid() and is_admin = true)
);
create policy "Admins can update users." on users for update using (
  exists (select 1 from users where id = auth.uid() and is_admin = true)
);

-- Requests policies
create policy "Users can view own requests." on requests for select using (auth.uid() = user_id);
create policy "Users can insert own requests." on requests for insert with check (auth.uid() = user_id);
create policy "Admins can view all requests." on requests for select using (
  exists (select 1 from users where id = auth.uid() and is_admin = true)
);
create policy "Admins can update requests." on requests for update using (
  exists (select 1 from users where id = auth.uid() and is_admin = true)
);

-- Events policies
create policy "Anyone can view events." on events for select using (true);
create policy "Admins can update events." on events for update using (
  exists (select 1 from users where id = auth.uid() and is_admin = true)
);

-- Function to handle new user signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: Create Browser Client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create Server Client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase supabase/schema.sql
git commit -m "feat: setup supabase clients and database schema"
```

---

### Task 3: Authentication Flow (Magic Link)

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/auth/confirm/route.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create Auth Middleware**

Create `middleware.ts`:
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

Create `lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 2: Create Login Page**

Create `app/login/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/confirm`,
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the login link!')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-rose-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-md text-center">
        <h1 className="text-3xl font-serif text-rose-800 mb-2">Prachi & Mayank</h1>
        <p className="text-gray-600 mb-8">Welcome to our wedding portal</p>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 border rounded-md border-gray-300 focus:ring-2 focus:ring-rose-500 outline-none"
            required
          />
          <Button 
            type="submit" 
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white p-3 rounded-md font-medium"
          >
            {loading ? 'Sending link...' : 'Send Magic Link'}
          </Button>
          {message && <p className="text-sm mt-4 text-gray-700">{message}</p>}
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create Auth Confirmation Route**

Create `app/auth/confirm/route.ts`:
```typescript
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      // redirect user to specified redirect URL or root of app
      redirect(next)
    }
  }

  // redirect the user to an error page with some instructions
  redirect('/login?error=Invalid_Token')
}
```

- [ ] **Step 4: Commit**

```bash
git add app/login middleware.ts lib/supabase/middleware.ts app/auth
git commit -m "feat: implement magic link authentication flow"
```

---

### Task 4: Guest Dashboard & Itinerary

**Files:**
- Modify: `app/page.tsx`
- Create: `components/Itinerary.tsx`
- Create: `app/actions/user.ts`

- [ ] **Step 1: Create Server Actions for User Data**

Create `app/actions/user.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'

export async function getUserProfile() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

export async function getEvents() {
  const supabase = createClient()
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('order_index', { ascending: true })
  
  return events || []
}
```

- [ ] **Step 2: Create Itinerary Component**

Create `components/Itinerary.tsx`:
```typescript
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
```

- [ ] **Step 3: Update Main Page (Dashboard)**

Modify `app/page.tsx`:
```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/Itinerary.tsx app/actions/user.ts
git commit -m "feat: implement guest dashboard and itinerary view"
```

---

### Task 5: Guest Request Center

**Files:**
- Create: `app/requests/page.tsx`
- Create: `app/actions/requests.ts`

- [ ] **Step 1: Create Server Actions for Requests**

Create `app/actions/requests.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitRequest(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Not authenticated')

  const type = formData.get('type') as string
  const details = formData.get('details') as string

  const { error } = await supabase
    .from('requests')
    .insert({
      user_id: user.id,
      type,
      details,
      status: 'pending'
    })

  if (error) throw error
  
  revalidatePath('/requests')
  revalidatePath('/admin')
  return { success: true }
}

export async function getMyRequests() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return data || []
}
```

- [ ] **Step 2: Build Requests Page**

Create `app/requests/page.tsx`:
```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add app/requests app/actions/requests.ts
git commit -m "feat: build guest request center form and history"
```

---

### Task 6: Admin Dashboard

**Files:**
- Create: `app/admin/page.tsx`
- Modify: `app/actions/requests.ts`

- [ ] **Step 1: Add Admin Actions**

Modify `app/actions/requests.ts` to append these functions at the bottom:
```typescript
export async function getAllRequests() {
  const supabase = createClient()
  
  // Verify admin status
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Unauthorized')

  const { data } = await supabase
    .from('requests')
    .select('*, users!requests_user_id_fkey(full_name, room_number)')
    .order('created_at', { ascending: false })

  return data || []
}

export async function updateRequestStatus(requestId: string, status: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const updates: any = { status }
  if (status === 'claimed') updates.assigned_admin_id = user.id

  await supabase
    .from('requests')
    .update(updates)
    .eq('id', requestId)

  revalidatePath('/admin')
}
```

- [ ] **Step 2: Build Admin Dashboard UI**

Create `app/admin/page.tsx`:
```typescript
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
                          <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">Claim</Button>
                        </form>
                      )}
                      {req.status === 'claimed' && (
                        <form action={updateRequestStatus.bind(null, req.id, 'resolved')}>
                          <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs">Resolve</Button>
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
```

- [ ] **Step 3: Commit**

```bash
git add app/admin app/actions/requests.ts
git commit -m "feat: implement admin dashboard to manage guest requests"
```

---

### Task 7: Photos Page & Final Polish

**Files:**
- Create: `app/photos/page.tsx`

- [ ] **Step 1: Create Photo Hub Page**

Create `app/photos/page.tsx`:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/photos
git commit -m "feat: add photo sharing hub linked to google photos"
```