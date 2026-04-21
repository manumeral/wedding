import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  const supabase = createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      redirect(next)
    } else {
      let errorMessage = error.message
      if (errorMessage.includes("PKCE code verifier not found")) {
        errorMessage = "You opened this link in a different browser or device. Please go back to your original browser and enter the 6-digit code!"
      }
      redirect(`/login?error=${encodeURIComponent(errorMessage)}`)
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      redirect(next)
    } else {
      redirect(`/login?error=${encodeURIComponent(error.message)}`)
    }
  }

  // If there's no code or token_hash, we might have an implicit flow hash fragment.
  // We can't see the hash fragment on the server, so we send an HTML page that reads it
  // and redirects to the correct place, or shows the error if it's missing.
  return new Response(`
    <html>
      <body>
        <p>Confirming authentication...</p>
        <script>
          const hash = window.location.hash;
          if (hash && hash.includes('access_token')) {
            // Implicit flow, redirect to home and let the browser client handle it
            window.location.replace('${next}' + hash);
          } else if (hash && hash.includes('error_description')) {
            const params = new URLSearchParams(hash.substring(1));
            window.location.replace('/login?error=' + encodeURIComponent(params.get('error_description')));
          } else {
            window.location.replace('/login?error=Missing_Token_Or_Code');
          }
        </script>
      </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}