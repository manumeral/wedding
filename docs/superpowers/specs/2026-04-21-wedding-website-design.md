# Wedding Website Design Spec: Prachi & Mayank
**Date:** 2026-04-21

## 1. Overview
A custom wedding web application for the upcoming wedding of Prachi & Mayank on 27th April '26. The platform serves as a digital hub for all guests (family, close friends, extended network, and colleagues), providing event information, logistics coordination, media sharing, and an interactive request center for guest assistance.

## 2. Architecture & Tech Stack
*   **Frontend & Backend:** Next.js (React framework) for both the UI and serverless API routes.
*   **Styling:** Tailwind CSS for rapid, responsive design.
*   **Database & Authentication:** Supabase (PostgreSQL + Auth). Chosen for robust relational data (linking guests to rooms/requests) and built-in Magic Link authentication.
*   **Hosting:** Vercel (for Next.js)

## 3. Core Features & Data Flow

### 3.1 User Authentication (Magic Link)
*   **Flow:** Guests enter their email address on the login page. Supabase sends a one-time magic link. Clicking the link authenticates them and sets a session cookie.
*   **Benefit:** Highly secure, prevents unauthorized access to private details (like room numbers), and removes the friction of remembering a password.

### 3.2 Guest Dashboard
Once logged in, the guest sees a personalized dashboard containing:
*   **Couple's Story:** Basic introduction to the bride, groom, and family members.
*   **Event Itinerary & Live Status:**
    *   25th April '26: Tilak (Afternoon) @ Vijaya Grand, Ashiana Nagar Patna
    *   26th April '26: Haldi (Afternoon) @ Chanakya Hotel, R Block, Patna
    *   26th April '26: Sangeet (Evening) @ Chanakya Hotel, R Block, Patna
    *   27th April '26: Wedding (Night) @ Chanakya Hotel, R Block, Patna
    *   29th April '26: Reception (Night) @ Grand Ivory, Biscoman Bhavan, Patna
    *   2nd May '26 (Assuming May 2nd based on chronological order of events, originally stated as 2nd April): Reception (Night) @ Bokaro Steel City
    *   *Live Status:* A simple flag/banner that organizers can update (e.g., "Sangeet starting in 15 mins!").
*   **Personal Logistics:**
    *   Room number assignment (pulled from the database linked to their profile).

### 3.3 Request Center (Guest View)
*   **Flow:** Guests can submit predefined requests via a form (e.g., "Need Cab Ride", "Station Pickup", "Water Bottle").
*   **Data:** Requests are saved to a `requests` table in Supabase, linked to the user's ID.
*   **Status:** Guests can see the status of their request (Pending, Claimed, Resolved).

### 3.4 Admin / Organizer Dashboard
*   **Access:** Restricted to users with an `is_admin` boolean flag in their profile.
*   **Features:**
    *   View all incoming guest requests in a tabular/kanban format.
    *   Ability to "Claim" a request (assigning it to themselves).
    *   Ability to mark a request as "Resolved".
    *   Update the "Live Status" banner for the itinerary.

### 3.5 Photo Sharing
*   **Flow:** A dedicated section linking to a shared Google Photos album.
*   **Implementation:** Simple, elegant UI linking out to the album URL to keep hosting costs zero while ensuring everyone knows where to drop their candid shots.

## 4. Database Schema (Supabase PostgreSQL)

*   `users` (managed mostly by Supabase Auth, extended with a public profile table)
    *   `id` (uuid, PK)
    *   `email` (string)
    *   `full_name` (string)
    *   `is_admin` (boolean, default false)
    *   `room_number` (string, nullable)
*   `requests`
    *   `id` (uuid, PK)
    *   `user_id` (uuid, FK to users)
    *   `type` (string: cab, water, pickup, etc.)
    *   `status` (string: pending, claimed, resolved)
    *   `assigned_admin_id` (uuid, FK to users, nullable)
    *   `created_at` (timestamp)
*   `events` (optional, could be hardcoded, but table allows live status updates)
    *   `id` (uuid, PK)
    *   `name` (string)
    *   `live_status_message` (string, nullable)

## 5. Security & Constraints
*   **Row Level Security (RLS) in Supabase:**
    *   Guests can only read their own profile and room number.
    *   Guests can only read and create their own requests.
    *   Admins can read/update all requests.
*   **Scope:** Avoid real-time live map tracking for requests; stick to status updates (Pending -> Claimed -> Resolved) to keep engineering scope manageable while still delivering high value.