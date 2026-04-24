import { NextResponse } from "next/server";

const AD_URL = "https://omg10.com/4/10919808";

// Script injected into ad HTML to intercept outbound link clicks
// and postMessage the parent frame instead of navigating away
const CLICK_INTERCEPTOR = `
<script>
(function(){
  document.addEventListener('click', function(e){
    var el = e.target.closest('a[href]');
    if(el){
      var href = el.getAttribute('href');
      if(href && href !== '#' && !href.startsWith('javascript')){
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage({type:'ad_link',url:el.href},'*');
      }
    }
  }, true);
})();
</script>
`;

export async function GET() {
  try {
    const res = await fetch(AD_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    let html = await res.text();

    // Fix relative URLs to resolve against the ad domain
    html = html.replace(/(<head[^>]*>)/i, `$1<base href="https://omg10.com/">${CLICK_INTERCEPTOR}`);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // No X-Frame-Options → iframe embedding allowed
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // Return blank page on error so iframe doesn't break
    return new NextResponse("<html><body style='background:#111'></body></html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
