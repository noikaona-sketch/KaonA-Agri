# KaonA-Agri

KaonA Agri-lineOA.

## Deployment / environment stability

Set these public environment variables in local `.env.local` and in your deployment platform (for example Vercel Project Settings → Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL` (required)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required)
- `NEXT_PUBLIC_LIFF_ID` (optional; LIFF bootstrap is skipped when missing)

The app now fails fast with a clear error message when required public variables are missing, which helps prevent unstable deployments caused by partially configured environments.
