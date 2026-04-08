import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // pass through response
  let response = NextResponse.next({
    request,
  });

  // intialize with cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // get new response with updated cookies
          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // get user
  const {
    data: { user },
  } = await supabase.auth.getUser();


  const pathname = request.nextUrl.pathname;
  // routes that anyone can access without an acc
  const publicRoutes = ["/", "/login", "/signup", "/forgot-password", "reset-password"];
  const isPublic = publicRoutes.includes(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

// run on everything but static assets like imgs 
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};