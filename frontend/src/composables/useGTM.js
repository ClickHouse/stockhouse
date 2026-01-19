import { ref, watch } from 'vue'

export function useGTM(gtmId) {
    const hasConsent = ref(false)
    const isScriptLoaded = ref(false)

    const loadGTM = () => {
        if (isScriptLoaded.value || !hasConsent.value) {
            return
        }

        // Initialize dataLayer
        window.dataLayer = window.dataLayer || []
        window.dataLayer.push({
            'gtm.start': new Date().getTime(),
            event: 'gtm.js'
        })

        // Load gtm.js script
        const script = document.createElement('script')
        script.async = true
        script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`

        // Insert after everything else or standard placement
        const firstScript = document.getElementsByTagName('script')[0]
        firstScript.parentNode.insertBefore(script, firstScript)

        isScriptLoaded.value = true
    }

    const setConsent = (consent) => {
        hasConsent.value = consent

        if (consent) {
            loadGTM()
        }
        // GTM handles consent internally via dataLayer events if configured, 
        // but here we primarily control the loading of the script itself.
    }

    watch(hasConsent, (newConsent) => {
        if (newConsent && !isScriptLoaded.value) {
            loadGTM()
        }
    })

    return {
        hasConsent,
        setConsent,
        isScriptLoaded
    }
}
