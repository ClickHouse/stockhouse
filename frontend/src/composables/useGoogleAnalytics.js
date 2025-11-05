import { ref, watch } from 'vue'

export function useGoogleAnalytics(gaId = 'G-KF1LLRTQ5Q') {
  const hasConsent = ref(false)
  const isScriptLoaded = ref(false)

  const loadGoogleAnalytics = () => {
    if (isScriptLoaded.value || !hasConsent.value) {
      return
    }

    // Load gtag.js script
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
    document.head.appendChild(script)

    // Initialize gtag
    window.dataLayer = window.dataLayer || []
    function gtag() {
      window.dataLayer.push(arguments)
    }
    window.gtag = gtag

    gtag('js', new Date())
    gtag('config', gaId, {
      anonymize_ip: true,
      cookie_flags: 'SameSite=None;Secure'
    })

    isScriptLoaded.value = true
    console.log('Google Analytics loaded with consent')
  }

  const setConsent = (consent) => {
    hasConsent.value = consent
    
    if (consent) {
      loadGoogleAnalytics()
    } else {
      console.log('Google Analytics consent declined')
      // Optionally: remove GA cookies if consent is declined
      if (window.gtag) {
        window.gtag('consent', 'update', {
          analytics_storage: 'denied'
        })
      }
    }
  }

  // Watch for consent changes
  watch(hasConsent, (newConsent) => {
    if (newConsent && !isScriptLoaded.value) {
      loadGoogleAnalytics()
    }
  })

  return {
    hasConsent,
    setConsent,
    isScriptLoaded
  }
}
