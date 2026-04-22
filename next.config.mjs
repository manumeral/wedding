/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig = {
  // googleapis has a huge dependency tree that confuses Next's bundler.
  // Let Node resolve it natively at runtime instead of webpack-bundling it.
  experimental: {
    serverComponentsExternalPackages: ['googleapis', 'google-auth-library'],
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
};

export default nextConfig;
