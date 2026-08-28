import { apiFetch } from '../lib/api';
// src/utils/SpeechService.ts

class SpeechService {
    private lang: string = 'en-IN';
    private voice: SpeechSynthesisVoice | null = null;
    private audio: HTMLAudioElement | null = null;
    private onEndCallback: (() => void) | null = null;
    private isSpeaking = false;
    private audioCache: Map<string, string> = new Map(); // Cache URL strings for generated audio
    private blobUrls: Set<string> = new Set(); // Track URLs to revoke later

    constructor() {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            // Listen to voiceschanged event to populate voices dynamically
            window.speechSynthesis.onvoiceschanged = () => {
                console.log("[SpeechService] voiceschanged event triggered.");
                this.updateVoice();
            };
            this.updateVoice();
        }
    }

    private updateVoice() {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        const voices = window.speechSynthesis.getVoices();
        const langCode = this.lang.toLowerCase().split('-')[0];
        
        console.log(`[SpeechService] Updating voice for lang: ${this.lang} (code: ${langCode}). Total voices: ${voices.length}`);

        // Try to find a voice matching the language code exactly, then by containing langCode
        let targetVoices = voices.filter(v => v.lang.toLowerCase() === this.lang.toLowerCase());
        if (targetVoices.length === 0) {
            targetVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langCode) || v.lang.toLowerCase().includes(langCode));
        }
        
        // Female voice indicators
        const femaleKeywords = ['female', 'woman', 'girl', 'lady', 'zira', 'samantha', 'victoria', 'heather', 'karen', 'moira', 'tessa', 'veena', 'kalpana', 'swara', 'swati', 'kavita', 'hema', 'priya', 'lata', 'shruti', 'shruthi', 'geetha', 'kavya', 'aria', 'pallavi', 'anjali', 'madhur', 'jessica', 'catherine', 'hazel', 'susan', 'catherine', 'ellen', 'lisa', 'katherine', 'anna', 'alice', 'mariska', 'yelena', 'mei-jia', 'sin-ji', 'ting-ting', 'swara', 'vani', 'monica', 'sara', 'elsa', 'martha', 'heera', 'rekha', 'sunita', 'jaya', 'kavitha', 'shanthi', 'vaishali', 'shravani', 'anupama', 'ananya', 'sneha', 'tanvi', 'adhira', 'komal', 'sapna', 'neelam', 'vidya', 'leela', 'madhavi', 'shanti', 'savitri', 'lakshmi', 'parvathi'];
        const maleKeywords = ['male', 'man', 'guy', 'boy', 'david', 'mark', 'james', 'pavel', 'ravi', 'karthik', 'anand', 'microsoft david', 'microsoft mark', 'microsoft james', 'hemant', 'prakash', 'rishabh', 'shlok', 'vijay', 'arjun', 'rahul', 'amit', 'suresh', 'ramesh', 'mohan', 'pawan', 'kalyan', 'mahesh'];

        const femaleVoice = targetVoices.find(v => {
            const name = v.name.toLowerCase();
            const isMale = maleKeywords.some(kw => name.includes(kw));
            if (isMale) return false;
            
            // If it explicitly says female, trust it
            if (name.includes('female')) return true;
            
            // For Indian languages, "NARAYANA NEXA" optimized voices (often Google-based or Microsoft-based) are preferred
            if (name.includes('google') && (name.includes('hindi') || name.includes('telugu') || name.includes('hi-in') || name.includes('te-in'))) {
                return true; 
            }

            return femaleKeywords.some(kw => name.includes(kw));
        });

        // Voice gender is not consistently exposed by browsers. Prefer a
        // recognisable female voice, then a language-matched voice so Hindi
        // and Telugu never fail silently on systems with limited voice packs.
        const anyFemaleVoice = voices.find(v =>
          femaleKeywords.some(keyword => v.name.toLowerCase().includes(keyword)) &&
          !maleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
        );

        // A Telugu voice is not installed on many Windows devices. Use the
        // best available female voice rather than leaving Speak Aloud blocked.
        this.voice = femaleVoice || targetVoices.find(v =>
          !maleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
        ) || anyFemaleVoice || targetVoices[0] || voices[0] || null;
        
        if (this.voice) {
            console.log(`[SpeechService] Selected female voice: ${this.voice.name} (${this.voice.lang})`);
        }
    }

    setLanguage(lang: string) {
        this.stop(); // Stop current speech on language switch
        const langMap: { [key: string]: string } = {
            'hi': 'hi-IN',
            'te': 'te-IN',
            'en': 'en-IN'
        };
        this.lang = langMap[lang] || 'en-US';
        this.updateVoice();
    }

    private abortController: AbortController | null = null;

    async speak(text: string, onEnd?: () => void) {
        if (this.isSpeaking) {
            this.stop(false);
        }
        
        // Cancel any pending API request
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        // Ensure small delay for cleanup if multiple clicks happen rapidly
        await new Promise(resolve => setTimeout(resolve, 50));

        this.onEndCallback = onEnd || null;
        this.isSpeaking = true;
        const langCode = this.lang.toLowerCase().split('-')[0];

        // 0. Clean text (remove markdown, URLs, etc. for better speech)
        const cleanText = text
            .replace(/[*_#`~]/g, '') // Remove markdown symbols
            .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
            .replace(/https?:\/\/[^\s]+/g, 'link') // Replace URLs with "link"
            .replace(/\n+/g, '. ') // Replace newlines with dots for better pacing
            .trim();

        if (!cleanText) {
            this.isSpeaking = false;
            if (onEnd) onEnd();
            return;
        }

        // 1. Force updating voices list if empty (important for some browsers)
        if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.getVoices();
            this.updateVoice();
        }

        // 2. Prefer the same cloud voice for English, Hindi, and Telugu.
        // Native browser speech is used only if the cloud request is unavailable.
        {
            const cacheKey = `${langCode}:${cleanText.slice(0, 150)}`;
            if (this.audioCache.has(cacheKey)) {
                console.log(`[SpeechService] Playing cached audio for ${langCode}.`);
                this.playFromUrl(this.audioCache.get(cacheKey)!, cleanText);
                return;
            }

            console.log(`[SpeechService] Requesting the shared Kore cloud voice for ${langCode}.`);
            try {
                this.abortController = new AbortController();
                const response = await apiFetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: cleanText, language: langCode }),
                    signal: this.abortController.signal
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.audio) {
                        const binary = atob(data.audio);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }
                        const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
                        const url = URL.createObjectURL(blob);
                        this.blobUrls.add(url);
                        this.audioCache.set(cacheKey, url);
                        this.playFromUrl(url, cleanText);
                        return;
                    }
                }
                throw new Error(response.statusText || "TTS API failed to return audio");
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    console.log("[SpeechService] TTS API request aborted.");
                    return;
                }
                console.warn("[SpeechService] Cloud TTS API failed, falling back to native browser speech synthesis:", err);
            } finally {
                this.abortController = null;
            }
        }

        // 4. Native Browser Fallback
        this.playNativeFallback(cleanText);
    }

    private playFromUrl(url: string, text: string) {
        if (this.audio) {
            this.audio.onended = null;
            this.audio.onerror = null;
            this.audio.pause();
            this.audio = null;
        }

        this.audio = new Audio(url);
        this.audio.onended = () => {
            this.isSpeaking = false;
            this.audio = null;
            if (this.onEndCallback) {
                const cb = this.onEndCallback;
                this.onEndCallback = null;
                cb();
            }
        };
        this.audio.onerror = (e) => {
            console.error("[SpeechService] Audio play error:", e);
            this.playNativeFallback(text);
        };
        
        this.audio.play().catch(err => {
            console.error("[SpeechService] Play promise rejected:", err);
            this.playNativeFallback(text);
        });
    }

    private playNativeFallback(text: string) {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
            this.handleFailure("Speech synthesis is not supported on this device/browser.");
            return;
        }

        if (!this.voice) {
            console.warn("[SpeechService] Refusing to use native speech as no female voice was found. Falling back to API retry if possible.");
            this.handleFailure("No female voice available for native playback.");
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Normalize language codes for better matching (e.g., 'hi' -> 'hi-IN')
        const langMap: Record<string, string> = {
            'hi': 'hi-IN',
            'te': 'te-IN',
            'en': 'en-US'
        };
        utterance.lang = langMap[this.lang] || this.lang;

        if (this.voice) {
            utterance.voice = this.voice;
        }

        utterance.rate = 0.92;
        utterance.pitch = 1.06;

        utterance.onend = () => {
            this.isSpeaking = false;
            if (this.onEndCallback) {
                const cb = this.onEndCallback;
                this.onEndCallback = null;
                cb();
            }
        };

        utterance.onerror = (e) => {
            if (e.error === "interrupted" || e.error === "canceled") {
                console.log("[SpeechService] Native speech interrupted/canceled.");
            } else {
                console.error("[SpeechService] Native speech error:", e);
                this.handleFailure(`Speech synthesis failed to play: ${e.error || "Unknown browser restriction"}`);
            }
            this.isSpeaking = false;
            if (this.onEndCallback) {
                const cb = this.onEndCallback;
                this.onEndCallback = null;
                cb();
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    private handleFailure(message: string) {
        console.warn(`[SpeechService] ${message}`);
        this.stop(true); // Reset state and trigger callback to clear speaking UI
        // Dispatch custom event to notify UI without failing silently
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('speech-error', { detail: { message } });
            window.dispatchEvent(event);
        }
    }

    clearCache() {
        this.blobUrls.forEach(url => URL.revokeObjectURL(url));
        this.blobUrls.clear();
        this.audioCache.clear();
    }

    stop(triggerCallback: boolean = true) {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
        this.isSpeaking = false;
        if (triggerCallback && this.onEndCallback) {
            const cb = this.onEndCallback;
            this.onEndCallback = null;
            cb();
        } else {
            this.onEndCallback = null;
        }
    }

    pause() {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.pause();
        }
        if (this.audio) this.audio.pause();
    }

    resume() {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.resume();
        }
        if (this.audio) {
            this.audio.play().catch(err => console.error("[SpeechService] Resume audio play error:", err));
        }
    }
}

export const speechService = new SpeechService();
if (typeof window !== 'undefined') {
    (window as any).speak = speechService.speak.bind(speechService);
}
