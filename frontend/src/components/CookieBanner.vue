<template>
  <Teleport to="body">
    <Transition name="cookie-fade">
      <div v-if="showBanner">
        <!-- Overlay -->
        <div class="cookie-overlay"></div>
        
        <!-- Cookie Banner -->
        <div class="cookie-container">
          <div class="cookie-content">
            <div class="cookie-image-wrapper">
              <img
                src="/cookie.svg"
                alt="cookie-image"
                width="80"
                height="80"
              />
            </div>
            
            <h3 class="cookie-title">Could we interest you in a cookie?</h3>
            
            <p class="cookie-description">
              ClickHouse uses cookies to make your experience extra sweet! Some keep things running smoothly (essential cookies), while others help us improve<br/>our site (analytics cookies).&nbsp;
              <a
                href="https://clickhouse.com/legal/cookie-policy"
                target="_blank"
                rel="noopener noreferrer nofollow"
                class="cookie-link"
              >
                Learn more
              </a>
            </p>
            
            <hr class="cookie-divider" />
            
            <div class="cookie-buttons">
              <button
                @click="handleAccept"
                class="cookie-button cookie-button-primary"
              >
                Accept cookies
              </button>
              <button
                @click="handleDecline"
                class="cookie-button cookie-button-secondary"
              >
                Reject cookies
              </button>
             
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['consent-change', 'banner-closed'])

const showBanner = ref(false)
const COOKIE_NAME = 'cookie-consent'
const COOKIE_EXPIRES_DAYS = 150

const getCookie = (name) => {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
  return null
}

const setCookie = (name, value, days) => {
  const date = new Date()
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
  const expires = `expires=${date.toUTCString()}`
  document.cookie = `${name}=${value};${expires};path=/`
}

const handleAccept = () => {
  setCookie(COOKIE_NAME, 'true', COOKIE_EXPIRES_DAYS)
  showBanner.value = false
  emit('consent-change', true)
  emit('banner-closed')
}

const handleDecline = () => {
  setCookie(COOKIE_NAME, 'false', COOKIE_EXPIRES_DAYS)
  showBanner.value = false
  emit('consent-change', false)
  emit('banner-closed')
}

onMounted(() => {
  const consent = getCookie(COOKIE_NAME)
  
  if (consent === null) {
    // No cookie found, show banner
    showBanner.value = true
  } else {
    // Cookie exists, emit the stored consent value
    emit('consent-change', consent === 'true')
    emit('banner-closed')
  }
})
</script>

<style scoped>
.cookie-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 9998;
}

.cookie-container {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  max-width: 400px;
  width: 90%;
  z-index: 9999;
  background-color: #1a1a1a;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
}

.cookie-content {
  font-size: 0.875rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.cookie-image-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.cookie-title {
  font-weight: 600;
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
  color: #ffffff;
}

.cookie-description {
  padding: 0.5em 0 0 0;
  font-size: 0.875rem;
  color: #DFDFDF;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.cookie-link {
  color: rgb(252, 255, 116);
  text-decoration: none;
}

.cookie-link:hover {
  text-decoration: underline;
}

.cookie-divider {
  border: none;
  border-top: 1px solid #333;
  margin: 1rem 0;
}

.cookie-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-top: auto;
}

.cookie-button {
  padding: 0.5rem 1.5rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  outline: none;
}

.cookie-button-primary {
  background-color: rgb(252, 255, 116);
  color: #000000;
}

.cookie-button-primary:hover {
  background-color: rgb(245, 248, 100);
}

.cookie-button-secondary {
  background-color: transparent;
  color: #ffffff;
  border: 1px solid #555;
}

.cookie-button-secondary:hover {
  background-color: #2a2a2a;
}

/* Transitions */
.cookie-fade-enter-active,
.cookie-fade-leave-active {
  transition: opacity 0.3s ease;
}

.cookie-fade-enter-from,
.cookie-fade-leave-to {
  opacity: 0;
}

.cookie-fade-enter-active .cookie-container {
  animation: slide-up 0.3s ease;
}

@keyframes slide-up {
  from {
    transform: translate(-50%, -40%);
    opacity: 0;
  }
  to {
    transform: translate(-50%, -50%);
    opacity: 1;
  }
}
</style>
