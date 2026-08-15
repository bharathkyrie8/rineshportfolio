-- ==============================================================================
-- SUPABASE DATABASE INITIALIZATION SCHEMA FOR RINESH KUMAR PORTFOLIO & CMS
-- ==============================================================================
-- Fully Idempotent (Safe to run & re-run anytime without errors)
-- ==============================================================================

-- 1. Create the primary portfolio_data table for master JSON syncing
CREATE TABLE IF NOT EXISTS public.portfolio_data (
    id TEXT PRIMARY KEY,
    content JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create the contact_messages table for visitor inquiries inbox
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT,
    subject TEXT,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    read BOOLEAN DEFAULT false
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.portfolio_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any existing policies before re-creating
DROP POLICY IF EXISTS "Allow public read on portfolio_data" ON public.portfolio_data;
DROP POLICY IF EXISTS "Allow anon & service insert/update on portfolio_data" ON public.portfolio_data;
DROP POLICY IF EXISTS "Allow public insert on contact_messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow read on contact_messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow update/delete on contact_messages" ON public.contact_messages;

-- 5. Create Policies for Public Read & Service/Anon Write
CREATE POLICY "Allow public read on portfolio_data"
ON public.portfolio_data FOR SELECT
USING (true);

CREATE POLICY "Allow anon & service insert/update on portfolio_data"
ON public.portfolio_data FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public insert on contact_messages"
ON public.contact_messages FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow read on contact_messages"
ON public.contact_messages FOR SELECT
USING (true);

CREATE POLICY "Allow update/delete on contact_messages"
ON public.contact_messages FOR ALL
USING (true)
WITH CHECK (true);

-- 6. Seed Initial Data for Rinesh Kumar Portfolio
INSERT INTO public.portfolio_data (id, content, updated_at)
VALUES (
  'master',
  '{
    "profile": {
      "name": "Rinesh Kumar",
      "topTitle": "RINESH",
      "bottomTitle": "KUMAR",
      "role": "Sound Engineer & Music Composer",
      "email": "rineshsoundscraft@gmail.com",
      "phone": "+91 93602 37280",
      "location": "Chennai, India",
      "bio": "Passionate Sound Engineer, Music Composer, and Sound Designer crafting immersive sonic experiences for films, media, and digital art.",
      "cvUrl": "assets/Rinesh_CV.pdf"
    },
    "branding": {
      "logoTop": "RINESH",
      "logoBottom": "KUMAR",
      "panelTitle": "RINESH KUMAR - Control Panel",
      "siteTitle": "Rinesh Kumar | Sound Designer & Audio Engineer"
    },
    "hero": {
      "title": "sound engineer",
      "subtitle": "Hello! I''m Rinesh Kumar, a professional sound engineer & music composer.",
      "description": "Sound engineering, design and music scoring made better.",
      "videoPath": "https://drive.google.com/file/d/1DrSEZ0NhLijo8nKydmF4wHoQM620O6tT/view?usp=sharing",
      "avatarUrl": "assets/images/thumbs/about-three-img.png",
      "stats": {
        "clientSatisfaction": 98,
        "projectsCompleted": 150,
        "globalClients": 96
      }
    },
    "about": {
      "sectionTitle": "I am dedicated to bringing your sonic vision to life by crafting unique, highly immersive, and impactful audio experiences.",
      "yearsExperience": "5+",
      "bio": [
        "I’m a passionate sound engineer, sound designer, and music composer focused on creating immersive, pristine audio experiences. With over 5 years of professional experience, I blend artistic creativity with advanced technical expertise to produce tracks, soundscapes, and scores that resonate deeply with listeners.",
        "With a strong ear for detail & a solid technical foundation in acoustics, mixing, and synthesis, I transform raw concepts into polished sonic realities. I believe great sound is purposeful—every layer, frequency, and transition is crafted to enhance the emotional impact of the project.",
        "From initial concept to final master, I work closely with filmmakers, game developers, and musicians to understand their goals and sonic vision."
      ],
      "stats": {
        "clientSatisfaction": 99,
        "filmsAlbumsScored": 50,
        "studioHours": 3200
      }
    },
    "socials": {
      "instagram": "https://www.instagram.com/rinesh_kumar_30?igsh=bjJtcndxaHdvZnpy",
      "whatsapp": "https://wa.me/919360237280",
      "linkedin": "https://www.linkedin.com/in/rinesh-kumar-92606b303/",
      "spotify": "https://spotify.com",
      "youtube": "https://youtube.com",
      "twitter": "https://twitter.com"
    },
    "works": [
      {
        "id": "work-1",
        "title": "MANGA",
        "subtitle": "Short Film",
        "category": "short-film",
        "categoryBadge": "Short Film",
        "image": "works/manga.webp",
        "mediaUrl": "",
        "description": "First look poster of our next Short Film MANGA. Written & Directed by Pradeep Spade.",
        "tags": ["Short Film", "Sound Design", "Score"],
        "status": "Completed",
        "featured": true
      },
      {
        "id": "work-2",
        "title": "The Briefcase",
        "subtitle": "Short Film",
        "category": "short-film",
        "categoryBadge": "Short Film",
        "image": "works/the_briefcase.webp",
        "mediaUrl": "",
        "description": "Official poster and first look of the thriller short film ''The Briefcase''.",
        "tags": ["Thriller", "Foley", "Mix"],
        "status": "Completed",
        "featured": true
      },
      {
        "id": "work-3",
        "title": "Puriyadha Puthir (Ep 3)",
        "subtitle": "Web Series",
        "category": "web-series",
        "categoryBadge": "Web Series",
        "image": "works/puriyadha_puthir_ep3.webp",
        "mediaUrl": "",
        "description": "Episode 3: ''Way to End''. The final episode of the thriller series coming soon.",
        "tags": ["Web Series", "BGM", "Surround"],
        "status": "Completed",
        "featured": true
      },
      {
        "id": "work-4",
        "title": "Butcher",
        "subtitle": "YouTube Release",
        "category": "youtube-release",
        "categoryBadge": "YouTube Release",
        "image": "works/butcher.jpg",
        "mediaUrl": "",
        "description": "Our short release ''Butcher'' is now streaming live on YouTube.",
        "tags": ["YouTube", "Post Production"],
        "status": "Completed",
        "featured": true
      },
      {
        "id": "work-5",
        "title": "Sugar Date",
        "subtitle": "YouTube Release",
        "category": "youtube-release",
        "categoryBadge": "YouTube Release",
        "image": "works/sugar_date.jpg",
        "mediaUrl": "",
        "description": "Sugar Date is live and out now on YouTube. Watch it now!",
        "tags": ["Soundtrack", "Mastering"],
        "status": "Completed",
        "featured": true
      },
      {
        "id": "work-6",
        "title": "Welcome on Board",
        "subtitle": "Short Film",
        "category": "short-film",
        "categoryBadge": "Short Film",
        "image": "works/welcome_on_board.webp",
        "mediaUrl": "",
        "description": "Not just a story, but an immersive cinematic experience. Welcome on Board is now live.",
        "tags": ["Cinematic", "Surround 5.1"],
        "status": "Completed",
        "featured": true
      },
      {
        "id": "work-7",
        "title": "Late Comers",
        "subtitle": "Short Film",
        "category": "short-film",
        "categoryBadge": "Short Film",
        "image": "works/late_comers.jpg",
        "mediaUrl": "",
        "description": "Stay tuned for the official trailer & release of our film ''Late Comers''.",
        "tags": ["Sound Design", "Foley"],
        "status": "Completed",
        "featured": true
      },
      {
        "id": "work-8",
        "title": "காத்திருங்கள் (Stay Tuned)",
        "subtitle": "Short Film",
        "category": "short-film",
        "categoryBadge": "Short Film",
        "image": "works/stay_tuned.jpg",
        "mediaUrl": "",
        "description": "Collaboration film project with the Tamil Nadu Police (Tenkasi Division).",
        "tags": ["Police Film", "BGM Score"],
        "status": "Completed",
        "featured": true
      },
      {
        "id": "work-9",
        "title": "It''s Done",
        "subtitle": "Short Film",
        "category": "short-film",
        "categoryBadge": "Short Film",
        "image": "works/its_done.webp",
        "mediaUrl": "",
        "description": "Post-production successfully wrapped for this Tamil short film project.",
        "tags": ["Post-Production", "Mixing"],
        "status": "Completed",
        "featured": true
      },
      {
        "id": "work-10",
        "title": "Personal Cinematic Project",
        "subtitle": "Personal Project",
        "category": "short-film",
        "categoryBadge": "Personal Project",
        "image": "works/most_personal.jpg",
        "mediaUrl": "",
        "description": "“The most personal is the most creative” — artistic showcase poster.",
        "tags": ["Artistic", "Soundscape"],
        "status": "Completed",
        "featured": true
      }
    ],
    "skills": [
      { "id": "skill-1", "name": "Pro Tools HD & DAW Production", "category": "DAW & Software", "percentage": 95 },
      { "id": "skill-2", "name": "Dolby Atmos 7.1.4 & 5.1 Surround", "category": "Mixing & Mastering", "percentage": 92 },
      { "id": "skill-3", "name": "Foley Recording & Sound Effects", "category": "Acoustic & Foley", "percentage": 94 },
      { "id": "skill-4", "name": "Cinematic Film Scoring & BGM", "category": "DAW & Software", "percentage": 90 },
      { "id": "skill-5", "name": "Audio Restoration & Clean Up (iZotope RX)", "category": "Mixing & Mastering", "percentage": 88 }
    ],
    "services": [
      { "id": "serv-1", "title": "Cinematic Sound Design", "description": "Custom sound effects, acoustic world-building, and layered atmospheric soundscapes tailored for films and trailers." },
      { "id": "serv-2", "title": "Surround Mixing & Dolby Atmos", "description": "High-fidelity spatial audio mixing in stereo, 5.1 surround, and Dolby Atmos formats." },
      { "id": "serv-3", "title": "Original Film & Game Scoring", "description": "Hybrid orchestral and electronic compositions designed to elevate narrative emotion." },
      { "id": "serv-4", "title": "Foley & ADR Post-Production", "description": "Pristine footsteps, cloth passes, prop handling, and dialogue synchronization." }
    ],
    "contact": {
      "sectionTitle": "Let’s create something meaningful",
      "email": "rineshsoundscraft@gmail.com",
      "phone": "+91 93602 37280",
      "whatsapp": "919360237280"
    },
    "security": {
      "adminPasscode": "admin123"
    },
    "messages": []
  }'::jsonb,
  timezone('utc'::text, now())
)
ON CONFLICT (id) 
DO UPDATE SET 
    content = EXCLUDED.content,
    updated_at = timezone('utc'::text, now());
