document.addEventListener('DOMContentLoaded', () => {
    
    // Check if GSAP and ScrollToPlugin are available (assumes they are linked in HTML)
    if (typeof gsap === 'undefined' || typeof ScrollToPlugin === 'undefined') {
        console.warn("GSAP or ScrollToPlugin not found. Using native smooth scroll.");
        
        // Fallback to native smooth scroll (existing code)
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', function(e) {
                if (this.getAttribute('href').length > 1) {
                    e.preventDefault();
                    document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
                    history.pushState(null, null, this.getAttribute('href'));
                }
            });
        });
        
    } else {
        // --- 1. GSAP-Controlled Smooth Scrolling (Slower and Smoother) ---
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', function(e) {
                const hash = this.getAttribute('href');
                
                if (hash.length > 1) {
                    e.preventDefault();
                    const targetElement = document.querySelector(hash);
                    
                    if (targetElement) {
                        // Use GSAP's ScrollToPlugin for a custom duration
                        gsap.to(window, {
                            duration: 1.2, // **THIS CONTROLS THE SCROLL SPEED (1.2 seconds)**
                            scrollTo: targetElement,
                            ease: "power2.inOut", // Elegant easing function
                            onComplete: () => history.pushState(null, null, hash)
                        });
                    }
                }
            });
        });
        
        // --- 2. Scroll Animation Setup (GSAP ScrollTrigger) ---
        // Register the necessary plugins
        gsap.registerPlugin(ScrollTrigger);
        
        // (Existing GSAP parallax and stagger code for the sections)
        gsap.from('.pillar', {
            y: 50,
            opacity: 0,
            stagger: 0.2,
            duration: 1,
            scrollTrigger: {
                trigger: '#services',
                start: "top 80%",
                toggleActions: "play none none none",
            }
        });
        
        gsap.to('#hero-animation-canvas', {
            yPercent: 10,
            ease: "none",
            scrollTrigger: {
                trigger: 'body',
                start: "top top",
                end: "bottom top",
                scrub: true,
            }
        });
    }

    // --- 3. Shiny Button and Background Placeholder functions remain below ---
    
    // ... (Omitted existing code for brevity, but remains in the file) ...
});