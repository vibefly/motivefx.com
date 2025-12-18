document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.remove('no-js');
    let morphController = null;
    const heroCanvas = document.querySelector('#hero-animation-canvas');

    const supportsWebGL = () => {
        try {
            const canvas = document.createElement('canvas');
            return !!window.WebGLRenderingContext && (
                canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
            );
        } catch (err) {
            return false;
        }
    };

    const enableStaticBackground = () => {
        document.body.classList.add('bg-fallback');
        if (heroCanvas) {
            heroCanvas.classList.add('static-bg');
        }
    };

    const markAnimatedBackground = () => {
        document.body.classList.add('bg-animated');
        document.body.classList.remove('bg-fallback');
        if (heroCanvas) {
            heroCanvas.classList.remove('static-bg');
        }
    };

    const initMorphingDots = () => {
        if (!supportsWebGL() || typeof MorphingDots === 'undefined' || typeof THREE === 'undefined') {
            console.warn('MorphingDots requires THREE.js and WebGL. Falling back to static background.');
            enableStaticBackground();
            return;
        }

        const accentColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-accent-neon')
            .trim() || '#f5ff1a';

        try {
            morphController = new MorphingDots({
                container: '#hero-animation-canvas',
                pointColor: accentColor,
            });
            if (morphController) {
                markAnimatedBackground();
            }
        } catch (err) {
            console.error('Failed to initialize MorphingDots. Using static background.', err);
            enableStaticBackground();
        }
    };

    const morphToSectionShape = (hash) => {
        if (!morphController || !hash || hash.length <= 1) {
            return;
        }
        const targetElement = document.querySelector(hash);
        if (targetElement && targetElement.dataset.morphShape) {
            morphController.morphTo(targetElement.dataset.morphShape);
        }
    };

    const bindSectionClicks = () => {
        const sections = document.querySelectorAll('[data-morph-shape]');
        sections.forEach(section => {
            if (section.id === 'hero') {
                return;
            }
            section.addEventListener('click', () => {
                const shape = section.dataset.morphShape;
                if (shape && morphController) {
                    morphController.morphTo(shape);
                }
            });
        });

        const scrollToTop = () => {
            if (typeof gsap !== 'undefined' && typeof ScrollToPlugin !== 'undefined') {
                gsap.to(window, {
                    duration: 1.8,
                    scrollTo: 0,
                    ease: 'power2.inOut',
                });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        const logo = document.querySelector('#main-header .logo');
        if (logo && !logo.hasAttribute('data-link-only')) {
            logo.addEventListener('click', (e) => {
                e.preventDefault();
                scrollToTop();
                history.replaceState(null, null, window.location.pathname);
            });
        }
    };

    const initNavToggle = () => {
        const navToggle = document.querySelector('.nav-toggle');
        const mainNav = document.querySelector('#main-nav');
        if (!navToggle || !mainNav) {
            return;
        }
        navToggle.addEventListener('click', () => {
            const expanded = navToggle.getAttribute('aria-expanded') === 'true';
            navToggle.setAttribute('aria-expanded', (!expanded).toString());
            mainNav.classList.toggle('is-open');
        });
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navToggle.setAttribute('aria-expanded', 'false');
                mainNav.classList.remove('is-open');
            });
        });
    };

    const revealSectionsOnScroll = () => {
        const revealTargets = document.querySelectorAll('section');
        if (typeof IntersectionObserver === 'undefined' || !revealTargets.length) {
            revealTargets.forEach(section => section.classList.add('section-visible'));
            return;
        }

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                entry.target.classList.toggle('section-visible', entry.isIntersecting);
            });
        }, {
            threshold: 0.25,
        });

        revealTargets.forEach(section => revealObserver.observe(section));
    };

    const observeSectionsOnScroll = () => {
        const sections = document.querySelectorAll('[data-morph-shape]');
        if (!sections.length || typeof IntersectionObserver === 'undefined') {
            return;
        }

        let activeShape = null;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter(entry => entry.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

            if (!visible.length) {
                return;
            }

            const candidate = visible[0].target;
            const shape = candidate.dataset.morphShape;
            if (shape && shape !== activeShape && morphController) {
                activeShape = shape;
                morphController.morphTo(shape);
            }
        }, {
            threshold: 0.45,
        });

        sections.forEach(section => observer.observe(section));

        const initialHash = window.location.hash;
        if (initialHash) {
            morphToSectionShape(initialHash);
        }
    };

    initMorphingDots();
    bindSectionClicks();
    observeSectionsOnScroll();
    revealSectionsOnScroll();
    initNavToggle();
    
    // Check if GSAP and ScrollToPlugin are available (assumes they are linked in HTML)
    if (typeof gsap === 'undefined' || typeof ScrollToPlugin === 'undefined') {
        console.warn("GSAP or ScrollToPlugin not found. Using native smooth scroll.");
        
        // Fallback to native smooth scroll (existing code)
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', function(e) {
                if (this.getAttribute('href').length > 1) {
                    e.preventDefault();
                    const hash = this.getAttribute('href');
                    const target = document.querySelector(hash);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                        morphToSectionShape(hash);
                        history.pushState(null, null, hash);
                    }
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
                        morphToSectionShape(hash);
                        // Use GSAP's ScrollToPlugin for a custom duration
                        gsap.to(window, {
                            duration: 1.8, // slower scroll duration
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
            duration: 1.6,
            scrollTrigger: {
                trigger: '#services',
                start: "top 80%",
                toggleActions: "play none none none",
            }
        });
        
        // Removed previous hero parallax tweak; GSAP handles other scroll effects above.
    }

    // --- 3. Shiny Button and Background Placeholder functions remain below ---
    
    // ... (Omitted existing code for brevity, but remains in the file) ...
});
