# Course video is served from a private Supabase bucket, after a one-time transcode

The digital course's 39 lessons are stored as 720p and 480p renditions in a private `course-videos` bucket and played through signed URLs minted server-side. There is no dedicated video platform. The source 1080p masters are never uploaded and never served.

The decision turns on a measurement rather than a preference: Eden's masters are encoded at **~6 Mbps**, roughly three times what a static interview shot needs on a phone. Re-encoding to 720p CRF 23 plus a 480p fallback takes the course from 5.41 GB to 1.16 GB. At that size, 250 trainees watching every lesson is ~224 GB of egress — inside the Pro plan's 250 GB cached-egress allowance. Hosting the course therefore costs nothing, against roughly $20/month plus a second vendor for Cloudflare Stream.

## Considered options

**Cloudflare Stream.** The strongest alternative, and the right answer at a different scale. It gives HLS/DASH adaptive bitrate for free, signed playback tokens, and per-minute delivery billing that stays predictable however large the files are. Rejected because it buys one thing we do not yet need — ABR — at the cost of a second vendor, a second bill, and a second set of credentials, for a catalogue of 130 minutes served to one academy. The transcode step we would own either way, since uploading 6 Mbps masters wastes delivery on any platform.

**Mux.** Rejected on cost. Delivery is billed per GB ($0.15/GB at the first tier), which is the wrong axis for video, and the per-view analytics depth is aimed at products where playback is the business.

**Supabase Storage serving the 1080p masters unchanged.** Rejected. It is the same infrastructure as the chosen option but ~4.7× the bytes, which pushes egress past the included allowance and, worse, asks a trainee on cellular to pull 6 Mbps for a talking head.

**A public bucket, as `avatars` already is.** Rejected. Paid course content behind a login cannot sit behind URLs that never expire.

## Consequences

**There is no adaptive bitrate.** Supabase Storage honours Range requests, so seeking and progressive playback work correctly, but it does not transcode to HLS/DASH. On a connection that degrades mid-lesson the player buffers where ABR would have dropped quality. The 480p rendition and the player's quality toggle are the deliberate stand-in: at ~0.6 Mbps it clears connections the 720p stream would stall on, at the cost of the trainee choosing rather than the player adapting. For 39 interview-shot lessons this is an acceptable trade. It would not be for match footage.

**We own the transcode step forever.** Every new lesson has to go through `scripts/transcode-course.ts` before upload. The script is idempotent and takes about 25 minutes for the whole course, but it is a step a human has to remember, and nothing in the product enforces it. The 250 MB bucket limit is the only backstop against someone uploading a master by hand.

**Access control lives in one place.** Playback reads the lesson through the request-scoped client so RLS decides visibility, then signs a two-hour URL with the service role. The bucket has no SELECT policy for trainees at all — the absence of one *is* the access control, which means adding a permissive storage policy later would silently widen access far more than it appears to.

**The revisit trigger is scale, not time.** If the catalogue passes a few hours of video or the audience passes a few hundred trainees, egress leaves the included allowance and ABR starts to matter for real. At that point Cloudflare Stream becomes the better answer, and the migration is narrow: `video_path` becomes a playback id and `getLessonPlaybackUrl` changes how it signs. Nothing above that function needs to know.
