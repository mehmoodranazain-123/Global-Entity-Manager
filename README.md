# Global Entity Manager — Standalone Deploy (Supabase + Netlify)

This is a self-hosted version of Global Entity Manager with:

- **Login required** — real email/password accounts via Supabase Auth. No one
  can view or edit data without signing in.
- **Shared, live data** — everyone who's signed in sees the same companies,
  directors, filings, and tasks, and edits appear for everyone instantly.
- **A working AI Assistant** — powered by your own Anthropic API key, called
  through a secure serverless function so the key is never exposed in the browser.
- No claude.ai branding anywhere — it's just your own Netlify URL.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account and project.
2. Open the **SQL Editor** and run:

```sql
create table gem_data (
  id integer primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table gem_data enable row level security;

create policy "Authenticated users can read"
  on gem_data for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert"
  on gem_data for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update"
  on gem_data for update
  using (auth.role() = 'authenticated');
```

This locks the data so **only signed-in users** can read or write it —
anonymous visitors are blocked entirely.

3. Turn on live sync: go to **Database > Replication**, find `gem_data`, and
   toggle it on. (Or run `alter publication supabase_realtime add table gem_data;`.)
4. Go to **Settings > API** and copy your **Project URL** and **anon public key**.
5. Go to **Authentication > Providers** and confirm **Email** is enabled (it is by default).
6. Decide how people get accounts:
   - **Self-serve sign-up** (simplest): leave things as-is. Anyone can create
     an account from the login screen using the "Create one" link.
   - **Invite-only** (recommended for a client-facing tool): go to
     **Authentication > Settings** and turn off "Allow new users to sign up."
     Then create accounts yourself under **Authentication > Users > Add user**
     and share the email/password with each person directly.
   - Also under **Authentication > Settings**, you can turn off "Confirm email"
     if you don't want new users to have to click a confirmation link first.

## 2. Get an Anthropic API key (for the AI Assistant)

1. Go to [console.anthropic.com](https://console.anthropic.com), create or sign in to an account.
2. Create an API key under **API Keys**. This is a paid, usage-billed key
   (separate from any claude.ai subscription) — the AI Assistant tab will use it.

## 3. Add your credentials locally

Copy `.env.example` to `.env` and fill in your Supabase values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

The Anthropic API key does **not** go in `.env` / the frontend — it's only
ever set as a Netlify environment variable (step 5), so it's never visible
in the browser.

## 4. Run it locally to test (optional but recommended)

```bash
npm install
npm run dev
```

Sign up for an account, confirm you can add a company, and check it's there
after a refresh. The AI Assistant won't work locally with `npm run dev`
(serverless functions need Netlify's environment) — test that after deploying.

## 5. Deploy to Netlify

**Recommended — connect a Git repo:**
1. Push this whole folder to a new GitHub repository.
2. In Netlify: **Add new site > Import an existing project**, pick that repo.
3. Build command: `npm run build` — Publish directory: `dist` (already set in `netlify.toml`).
4. In **Site settings > Environment variables**, add all three:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY` (your key from step 2 — this one powers the AI Assistant function)
5. Deploy. Netlify gives you a URL like `your-site-name.netlify.app` — share that.

**Alternative — drag and drop:** run `npm run build` locally and drag the
`dist` folder into [app.netlify.com/drop](https://app.netlify.com/drop). Note
that serverless functions (the AI Assistant) only deploy via the Git-connected
method or the Netlify CLI, not plain drag-and-drop — use the Git method if you
want the AI Assistant working.

## How it all fits together

- **Login screen** — Supabase Auth. No account, no access to any data.
- **Companies/Directors/Documents/etc.** — read and written directly from the
  browser to your `gem_data` table, restricted to signed-in users by the RLS
  policies above.
- **AI Assistant** — the browser calls `/.netlify/functions/ai-assistant`,
  which runs on Netlify's servers, attaches your `ANTHROPIC_API_KEY`, calls
  Anthropic, and returns the answer. Your key never reaches the browser.

## Notes on the permission model

- Every signed-in user can edit everything — there's no per-role restriction
  enforced at the database level yet (the "Read Only" / "Client Portal" roles
  in Settings are a visual toggle only, not real security).
- If you need some accounts to be view-only in a way that's actually
  enforced, that requires storing each user's role in Supabase and writing
  RLS policies that check it — ask and I can add that.

