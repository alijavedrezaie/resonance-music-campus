# YouTube chord analysis

The campus submits a YouTube URL to [Magic Chords' public API](https://magic-chords.dev/api). A `guitar-youtube` Supabase Edge Function relays requests because that API does not allow direct cross-origin requests from GitHub Pages. It returns only chord segments, key, tempo, meter and status. All requests require the current campus owner's Supabase session and an active `campus_is_owner()` check.

## Deploy to the existing campus project

Use a connected Supabase integration, or the [Supabase CLI deployment workflow](https://supabase.com/docs/guides/functions/deploy). Deploy both files in `supabase/functions/guitar-youtube/` under function name `guitar-youtube`, with JWT verification enabled. Match the project reference to the URL in the live campus's `js/hosting-config.js`. Do not create a new project or change the owner registry.

The Supabase function runtime supplies `SUPABASE_URL` and `SUPABASE_ANON_KEY`. No provider API key, service-role key or account password is needed. The source `supabase/config.toml` keeps `verify_jwt = true`.

For an authenticated CLI:

```sh
supabase functions deploy guitar-youtube --project-ref YOUR_EXISTING_CAMPUS_PROJECT_REF
```

Publish the frontend using the existing GitHub Pages workflow. Verify that a signed-out request to the function is rejected, then sign in to the campus and analyze a public music video. Confirm that the chord chart, estimated key/tempo and timestamped timeline load, and Save adds the chart to Songbook.

The CORS allowlist is the existing campus origin `https://alijavedrezaie.github.io`. Update it deliberately if hosting changes. CORS is not authorization: the function always checks the owner RPC, including that owner's Auth session.

## Provider limits and data

Magic Chords receives the submitted public YouTube URL. Its documented anonymous quota is 12 submissions/hour and 30 status/result reads/minute, subject to change. The relay polls at five-second intervals and surfaces quota, video availability and processing errors. Quotas apply to the relay's outbound IP; no unlimited-service promise is made. It does not accept YouTube login cookies. Some public videos may work while others cannot be accessed.

The service returned a completed analysis for `https://www.youtube.com/watch?v=2Vv-BfVoq4g` during implementation on November 3, 2026. The first test video returned `url_media_unavailable`; the app handles that as a failed video, not an empty or fabricated chart. This is a provider test, not confirmation that the campus Edge Function has been deployed.

Strumming patterns remain suggestions. The practice trainer follows equal-duration chord steps independently of the source timeline; its 3/4 and 4/4 settings are labeled as practice meter. Seventh and slash chords retain their labels. Unsupported chord voicings show no diagram instead of an incorrectly labeled triad.

## Video-to-lyrics transcription

The **Lyrics & chords** tab accepts a YouTube link and submits a separate transcription job using `/api/v1/transcribe/url`. The existing owner-only relay exposes `lyrics-submit` and `lyrics-result` actions, sharing the same status polling and cancellation behavior. The relay returns bounded transcript text and word timestamps; provider paths, audio URLs and other internal metadata stay server-side.

Deploy the updated `guitar-youtube` function alongside the frontend to enable these actions. No additional API key or database migration is needed. Generated words fill an empty sheet automatically. If a draft already exists, the user reviews the generated version and explicitly replaces it. Lyrics can be corrected and saved to Songbook using the existing backup format. Chord markers are added manually; this does not claim automatic word-to-chord alignment. Quota errors, unavailable media and instrumental/empty transcripts are shown in the lyrics tab.
