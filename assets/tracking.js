(function () {
  const config = window.ASH_TRACKING || {};
  const pageType = config.pageType || "unknown";
  const funnel = config.funnel || "sel_to_protection";
  const gaId = (config.gaId || "").trim();
  const clarityId = (config.clarityId || "").trim();
  const debug = config.debug || new URLSearchParams(window.location.search).has("debug_tracking");
  const gaReady = /^G-[A-Z0-9]+$/i.test(gaId);
  const clarityReady = /^[a-z0-9]{5,}$/i.test(clarityId);
  const videoMilestones = new WeakMap();
  let emailFocusTracked = false;

  function log(name, params) {
    if (debug) console.info("[ASH tracking]", name, params);
  }

  function baseParams(params) {
    return Object.assign({
      funnel,
      page_type: pageType,
      page_path: window.location.pathname,
      page_location: window.location.href,
      page_title: document.title
    }, params || {});
  }

  function track(name, params) {
    const payload = baseParams(params);
    log(name, payload);
    if (window.gtag) window.gtag("event", name, payload);
  }

  function trackAndNavigate(name, params, href) {
    const payload = baseParams(params);
    let navigated = false;
    const go = () => {
      if (navigated) return;
      navigated = true;
      window.location.href = href;
    };

    log(name, payload);

    if (window.gtag) {
      window.gtag("event", name, Object.assign({}, payload, {
        event_callback: go,
        event_timeout: 700
      }));
      window.setTimeout(go, 750);
      return;
    }

    window.setTimeout(go, 180);
  }

  function loadGa() {
    if (!gaReady) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId);
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", gaId, {
      anonymize_ip: true,
      send_page_view: false
    });
  }

  function loadClarity() {
    if (!clarityReady) return;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", clarityId);
  }

  function copyCampaignParams(url) {
    const current = new URLSearchParams(window.location.search);
    const target = new URL(url);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

    keys.forEach((key) => {
      if (current.has(key) && !target.searchParams.has(key)) {
        target.searchParams.set(key, current.get(key));
      }
    });

    if (!target.searchParams.has("utm_source")) target.searchParams.set("utm_source", "ash_site");
    if (!target.searchParams.has("utm_medium")) target.searchParams.set("utm_medium", pageType);
    if (!target.searchParams.has("utm_campaign")) target.searchParams.set("utm_campaign", funnel);
    if (!target.searchParams.has("utm_content")) target.searchParams.set("utm_content", "payhip_cta");

    return target.toString();
  }

  function decoratePayhipLinks() {
    document.querySelectorAll('a[href*="payhip.com/"]').forEach((link) => {
      try {
        link.href = copyCampaignParams(link.href);
      } catch (error) {
        log("ash_tracking_link_error", { href: link.href });
      }
    });
  }

  function bindClicks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      const submit = event.target.closest('input[type="submit"], button[type="submit"]');

      if (link) {
        const href = link.href || "";
        if (/\.pdf(\?|#|$)/i.test(href)) {
          track("ash_pdf_click", {
            asset_type: "pdf",
            link_text: link.textContent.trim(),
            destination: href
          });
        }

        if (href.includes("payhip.com/")) {
          track("ash_payhip_click", {
            destination: href,
            link_text: link.textContent.trim(),
            value: 17,
            currency: "EUR"
          });
        }
      }

      if (submit && submit.closest(".leadForm")) {
        track("ash_lead_submit_click", {
          form_name: "emailoctopus_sel_pdf"
        });
      }
    }, true);
  }

  function bindForms() {
    document.addEventListener("focusin", (event) => {
      if (!emailFocusTracked && event.target.matches('.leadForm input[type="email"]')) {
        emailFocusTracked = true;
        track("ash_lead_email_focus", {
          form_name: "emailoctopus_sel_pdf"
        });
      }
    });

    document.addEventListener("submit", (event) => {
      if (event.target.closest(".leadForm")) {
        track("ash_lead_submit", {
          form_name: "emailoctopus_sel_pdf"
        });
      }
    }, true);
  }

  function bindVideos() {
    document.querySelectorAll("video").forEach((video, index) => {
      const videoName = video.dataset.trackVideo || "video_" + (index + 1);
      videoMilestones.set(video, new Set());

      video.addEventListener("play", () => {
        track("ash_video_play", { video_name: videoName });
      }, { once: true });

      video.addEventListener("timeupdate", () => {
        if (!video.duration) return;
        const percent = Math.floor((video.currentTime / video.duration) * 100);
        const reached = videoMilestones.get(video);
        [25, 50, 75].forEach((milestone) => {
          if (percent >= milestone && !reached.has(milestone)) {
            reached.add(milestone);
            track("ash_video_progress", {
              video_name: videoName,
              progress_percent: milestone
            });
          }
        });
      });

      video.addEventListener("ended", () => {
        track("ash_video_complete", { video_name: videoName });
      });
    });
  }

  function init() {
    loadGa();
    loadClarity();
    decoratePayhipLinks();
    bindClicks();
    bindForms();
    bindVideos();
    track("ash_page_view");
  }

  window.ashTrack = track;
  window.ashTrackNavigate = trackAndNavigate;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
