import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  COURSE_ONLY_HOME,
  isPathAllowedForTier,
  resolveAccessTier,
  type AccessOverride,
} from "@/lib/access/course-access";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes
  const protectedPaths = ["/dashboard", "/admin"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Fetch profile once for all protected-path checks
  let profile: {
    profile_completed: boolean;
    role: string;
    arbox_paid_training: boolean;
    arbox_bought_course: boolean;
    access_override: AccessOverride;
  } | null = null;

  if (user && isProtectedPath) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "profile_completed, role, arbox_paid_training, arbox_bought_course, access_override"
      )
      .eq("id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    profile = data;
  }

  // Profile completion check for dashboard routes
  if (user && request.nextUrl.pathname.startsWith("/dashboard")) {
    // Admin/trainer users should use the admin area (skip onboarding)
    if (profile?.role === "admin" || profile?.role === "trainer") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // Redirect trainees to onboarding if profile is not complete
    if (profile && !profile.profile_completed) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding/profile";
      return NextResponse.redirect(url);
    }

    // Someone who bought only the digital course sees only the digital course.
    // Checked here rather than per-page so a new trainee route is restricted by
    // default instead of leaking until someone remembers to gate it.
    if (profile) {
      const tier = resolveAccessTier({
        arboxPaidTraining: profile.arbox_paid_training,
        arboxBoughtCourse: profile.arbox_bought_course,
        accessOverride: profile.access_override,
      });

      if (!isPathAllowedForTier(tier, request.nextUrl.pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = COURSE_ONLY_HOME;
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  // Admin-only routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (profile?.role !== "admin" && profile?.role !== "trainer") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
